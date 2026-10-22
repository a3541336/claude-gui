// Shapes of claude's `--output-format stream-json` lines.
// Only the fields the UI reads are typed; unknown fields and line types are ignored.

export type PermissionMode = "default" | "acceptEdits" | "plan" | "bypassPermissions";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content?: string | Array<{ type: string; text?: string }>;
      is_error?: boolean;
    };

export interface StreamLine {
  type: string;
  subtype?: string;
  [key: string]: unknown;
}

export interface SystemInitLine extends StreamLine {
  type: "system";
  subtype: "init";
  session_id: string;
  model: string;
  cwd: string;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface AssistantLine extends StreamLine {
  type: "assistant";
  message: { content: ContentBlock[]; usage?: Usage };
  parent_tool_use_id: string | null;
}

export interface UserLine extends StreamLine {
  type: "user";
  message: { content: string | ContentBlock[] };
  parent_tool_use_id: string | null;
}

export interface ResultLine extends StreamLine {
  type: "result";
  subtype: string;
  session_id: string;
  is_error: boolean;
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  /** Keyed by model id. */
  modelUsage?: Record<string, { contextWindow?: number }>;
}

/** Subscription usage window. */
export interface RateLimitWindow {
  /** Fraction used, usually 0-1; can exceed 1. */
  utilization: number;
  /** Unix epoch seconds. */
  resetsAt: number;
}

export interface RateLimitWindows {
  five_hour?: RateLimitWindow;
  seven_day?: RateLimitWindow;
}

/** Absent for API-key, Bedrock and Vertex sessions. */
export interface RateLimitEventLine extends StreamLine {
  type: "rate_limit_event";
  rate_limit_info: { unifiedWindows?: RateLimitWindows };
}

/** A permission rule change claude offers alongside a prompt. */
export interface PermissionSuggestion {
  type: string;
  [key: string]: unknown;
}

export interface CanUseToolRequest {
  subtype: "can_use_tool";
  tool_name: string;
  display_name?: string;
  input: Record<string, unknown>;
  description?: string;
  /** Why claude is asking, when it isn't simply the permission mode. */
  decision_reason?: string;
  permission_suggestions?: PermissionSuggestion[];
  tool_use_id?: string;
}

/** Sent with `--permission-prompt-tool stdio`; claude waits for a `control_response`. */
export interface ControlRequestLine extends StreamLine {
  type: "control_request";
  request_id: string;
  request: CanUseToolRequest | { subtype: string };
}

/** claude no longer needs the answer, e.g. after an interrupt. */
export interface ControlCancelRequestLine extends StreamLine {
  type: "control_cancel_request";
  request_id: string;
}

export type PermissionResponse =
  | {
      behavior: "allow";
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: PermissionSuggestion[];
    }
  | { behavior: "deny"; message: string };

/** A raw API streaming event, sent with `--include-partial-messages`. */
export interface StreamEventLine extends StreamLine {
  type: "stream_event";
  parent_tool_use_id: string | null;
  event:
    | { type: "message_start" | "message_stop" | "message_delta" | "content_block_stop" }
    | { type: "content_block_start"; index: number; content_block: { type: string } }
    | {
        type: "content_block_delta";
        index: number;
        delta: { type: "text_delta"; text: string } | { type: "thinking_delta"; thinking: string } | { type: string };
      };
}
