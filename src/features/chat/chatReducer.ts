// Turns the stream of claude events into a flat list of chat entries.

import type {
  AssistantLine,
  CanUseToolRequest,
  ContentBlock,
  ControlCancelRequestLine,
  ControlRequestLine,
  ResultLine,
  StreamEventLine,
  StreamLine,
  SystemInitLine,
  Usage,
  UserLine,
} from "../../shared/types/claude";

export interface ToolResult {
  text: string;
  isError: boolean;
}

export type ChatEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "text"; id: string; text: string }
  | { kind: "thinking"; id: string; text: string }
  | { kind: "tool"; id: string; name: string; input: Record<string, unknown>; result?: ToolResult }
  | {
      kind: "result";
      id: string;
      isError: boolean;
      costUsd?: number;
      durationMs?: number;
      numTurns?: number;
    }
  | { kind: "notice"; id: string; level: "info" | "error"; text: string }
  /** `id` is claude's request_id, which the answer must echo. */
  | { kind: "permission"; id: string; request: CanUseToolRequest; status: PermissionStatus };

export interface Draft {
  kind: "text" | "thinking";
  text: string;
}

export type PermissionStatus = "pending" | "allowed" | "denied" | "cancelled";

export interface ChatState {
  /** Local id under which the conversation is saved to history. */
  conversationId: string;
  /** Time of the last user message, in ms. */
  updatedAt: number | null;
  entries: ChatEntry[];
  busy: boolean;
  /** claude's own session id, used to resume after the process restarts. */
  claudeSessionId: string | null;
  model: string | null;
  /** The main-thread text or thinking block still streaming; replaced by its complete message. */
  draft: Draft | null;
  /** Tokens in the context as of the latest main-thread response; null until known. */
  contextTokens: number | null;
  contextWindow: number | null;
}

export type ChatAction =
  | { type: "userSent"; text: string }
  | { type: "line"; line: StreamLine }
  | { type: "stderr"; text: string }
  | { type: "exited"; code: number | null }
  | { type: "detached"; notice?: string }
  | { type: "error"; text: string }
  | { type: "permissionAnswered"; requestId: string; allowed: boolean }
  | { type: "notice"; level: "info" | "error"; text: string };

/** A saved conversation, restored from history. */
export type ChatSnapshot = Omit<ChatState, "busy" | "draft" | "contextTokens" | "contextWindow">;

/** A new conversation, or a saved one to continue. */
export function createChatState(conversationId: string, snapshot?: ChatSnapshot): ChatState {
  return {
    updatedAt: null,
    entries: [],
    claudeSessionId: null,
    model: null,
    ...snapshot,
    conversationId,
    busy: false,
    draft: null,
    contextTokens: null,
    contextWindow: null,
    // The process that asked is gone, so saved prompts can't be answered.
    ...(snapshot && { entries: cancelPending(snapshot.entries) }),
  };
}

const newId = () => crypto.randomUUID();

const notice = (level: "info" | "error", text: string): ChatEntry => ({
  kind: "notice",
  id: newId(),
  level,
  text,
});

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "userSent":
      return {
        ...state,
        updatedAt: Date.now(),
        busy: true,
        entries: [...state.entries, { kind: "user", id: newId(), text: action.text }],
      };
    case "line":
      return applyLine(state, action.line);
    case "stderr":
      return { ...state, entries: [...state.entries, notice("error", action.text)] };
    case "exited": {
      const text =
        action.code === null
          ? "已中斷，下次送出訊息時會接續這段對話"
          : `claude 已結束（代碼 ${action.code}）`;
      const level = action.code === null || action.code === 0 ? "info" : "error";
      return {
        ...state,
        busy: false,
        draft: null,
        entries: [...cancelPending(state.entries), notice(level, text)],
      };
    }
    case "detached": {
      const entries = cancelPending(state.entries);
      return {
        ...state,
        busy: false,
        draft: null,
        entries: action.notice ? [...entries, notice("info", action.notice)] : entries,
      };
    }
    case "error":
      return {
        ...state,
        busy: false,
        draft: null,
        entries: [...cancelPending(state.entries), notice("error", action.text)],
      };
    case "notice":
      return { ...state, entries: [...state.entries, notice(action.level, action.text)] };
    case "permissionAnswered":
      return {
        ...state,
        entries: setPermissionStatus(
          state.entries,
          action.requestId,
          action.allowed ? "allowed" : "denied",
        ),
      };
  }
}

function applyLine(state: ChatState, line: StreamLine): ChatState {
  switch (line.type) {
    case "system": {
      if (line.subtype !== "init") return state;
      const init = line as SystemInitLine;
      return { ...state, claudeSessionId: init.session_id, model: init.model };
    }
    case "assistant": {
      const { message, parent_tool_use_id } = line as AssistantLine;
      const added = message.content.flatMap(blockToEntry);
      // Subagents run in their own context.
      const contextTokens =
        message.usage && parent_tool_use_id === null
          ? contextSize(message.usage)
          : state.contextTokens;
      return {
        ...state,
        contextTokens,
        draft: parent_tool_use_id === null ? null : state.draft,
        entries: [...state.entries, ...added],
      };
    }
    case "stream_event": {
      const { event, parent_tool_use_id } = line as StreamEventLine;
      if (parent_tool_use_id !== null) return state;
      return { ...state, draft: applyStreamEvent(state.draft, event) };
    }
    case "control_request": {
      const { request_id, request } = line as ControlRequestLine;
      if (request.subtype !== "can_use_tool") {
        return {
          ...state,
          entries: [...state.entries, notice("error", `不支援的 claude 請求：${request.subtype}`)],
        };
      }
      const entry: ChatEntry = {
        kind: "permission",
        id: request_id,
        request: request as CanUseToolRequest,
        status: "pending",
      };
      return { ...state, entries: [...state.entries, entry] };
    }
    case "control_cancel_request": {
      const { request_id } = line as ControlCancelRequestLine;
      return { ...state, entries: setPermissionStatus(state.entries, request_id, "cancelled") };
    }
    case "user": {
      const { message } = line as UserLine;
      if (typeof message.content === "string") return state;
      let entries = state.entries;
      for (const block of message.content) {
        if (block.type === "tool_result") entries = attachToolResult(entries, block);
      }
      return { ...state, entries };
    }
    case "result": {
      const result = line as ResultLine;
      return {
        ...state,
        busy: false,
        draft: null,
        claudeSessionId: result.session_id,
        contextWindow: contextWindowOf(result, state.model) ?? state.contextWindow,
        entries: [
          ...state.entries,
          {
            kind: "result",
            id: newId(),
            isError: result.is_error,
            costUsd: result.total_cost_usd,
            durationMs: result.duration_ms,
            numTurns: result.num_turns,
          },
        ],
      };
    }
    default:
      return state;
  }
}

type StreamEvent = StreamEventLine["event"];

function applyStreamEvent(draft: Draft | null, event: StreamEvent): Draft | null {
  switch (event.type) {
    case "content_block_start": {
      const { type } = (event as Extract<StreamEvent, { type: "content_block_start" }>).content_block;
      return type === "text" || type === "thinking" ? { kind: type, text: "" } : null;
    }
    case "content_block_delta": {
      const { delta } = event as Extract<StreamEvent, { type: "content_block_delta" }>;
      if (!draft) return null;
      if ("text" in delta) return { ...draft, text: draft.text + delta.text };
      if ("thinking" in delta) return { ...draft, text: draft.text + delta.thinking };
      return draft;
    }
    case "content_block_stop":
    case "message_start":
    case "message_stop":
      return null;
    default:
      return draft;
  }
}

function setPermissionStatus(
  entries: ChatEntry[],
  requestId: string,
  status: PermissionStatus,
): ChatEntry[] {
  return entries.map((e) =>
    e.kind === "permission" && e.id === requestId && e.status === "pending" ? { ...e, status } : e,
  );
}

function cancelPending(entries: ChatEntry[]): ChatEntry[] {
  return entries.some((e) => e.kind === "permission" && e.status === "pending")
    ? entries.map((e) =>
        e.kind === "permission" && e.status === "pending" ? { ...e, status: "cancelled" } : e,
      )
    : entries;
}

function contextSize(usage: Usage): number {
  return (
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    usage.output_tokens
  );
}

/** The main model's window; other entries may be subagents on smaller models. */
function contextWindowOf(result: ResultLine, model: string | null): number | null {
  const usage = result.modelUsage ?? {};
  const own = model ? usage[model]?.contextWindow : undefined;
  if (own) return own;
  const windows = Object.values(usage).flatMap((u) => (u.contextWindow ? [u.contextWindow] : []));
  return windows.length > 0 ? Math.max(...windows) : null;
}

function blockToEntry(block: ContentBlock): ChatEntry[] {
  switch (block.type) {
    case "text":
      return block.text.trim() ? [{ kind: "text", id: newId(), text: block.text }] : [];
    case "thinking":
      return block.thinking.trim() ? [{ kind: "thinking", id: newId(), text: block.thinking }] : [];
    case "tool_use":
      return [{ kind: "tool", id: block.id, name: block.name, input: block.input }];
    default:
      return [];
  }
}

function attachToolResult(
  entries: ChatEntry[],
  block: Extract<ContentBlock, { type: "tool_result" }>,
): ChatEntry[] {
  const result: ToolResult = {
    text: toolResultText(block.content),
    isError: block.is_error ?? false,
  };
  return entries.map((e) =>
    e.kind === "tool" && e.id === block.tool_use_id ? { ...e, result } : e,
  );
}

function toolResultText(content: Extract<ContentBlock, { type: "tool_result" }>["content"]) {
  if (content === undefined) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? (part.text ?? "") : `[${part.type}]`))
    .join("\n");
}
