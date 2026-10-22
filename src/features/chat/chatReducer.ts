// Turns the stream of claude events into a flat list of chat entries.

import type {
  AssistantLine,
  ContentBlock,
  ResultLine,
  StreamLine,
  SystemInitLine,
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
  | { kind: "notice"; id: string; level: "info" | "error"; text: string };

export interface ChatState {
  /** Local id under which the conversation is saved to history; set on the first message. */
  conversationId: string | null;
  /** Time of the last user message, in ms. */
  updatedAt: number | null;
  entries: ChatEntry[];
  busy: boolean;
  /** claude's own session id, used to resume after the process restarts. */
  claudeSessionId: string | null;
  model: string | null;
}

export type ChatAction =
  | { type: "userSent"; text: string }
  | { type: "line"; line: StreamLine }
  | { type: "stderr"; text: string }
  | { type: "exited"; code: number | null }
  | { type: "detached"; notice?: string }
  | { type: "error"; text: string }
  | { type: "reset" }
  | { type: "load"; snapshot: ChatSnapshot };

/** A saved conversation, restored from history. */
export type ChatSnapshot = Omit<ChatState, "busy">;

export const initialChatState: ChatState = {
  conversationId: null,
  updatedAt: null,
  entries: [],
  busy: false,
  claudeSessionId: null,
  model: null,
};

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
        conversationId: state.conversationId ?? newId(),
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
      return { ...state, busy: false, entries: [...state.entries, notice(level, text)] };
    }
    case "detached":
      return {
        ...state,
        busy: false,
        entries: action.notice ? [...state.entries, notice("info", action.notice)] : state.entries,
      };
    case "error":
      return { ...state, busy: false, entries: [...state.entries, notice("error", action.text)] };
    case "reset":
      return initialChatState;
    case "load":
      return { ...action.snapshot, busy: false };
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
      const { message } = line as AssistantLine;
      const added = message.content.flatMap(blockToEntry);
      return { ...state, entries: [...state.entries, ...added] };
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
        claudeSessionId: result.session_id,
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
