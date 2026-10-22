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

export interface AssistantLine extends StreamLine {
  type: "assistant";
  message: { content: ContentBlock[] };
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
}
