// Typed bridge to the Rust backend. Command and event names must match
// `src-tauri/src/lib.rs` and `src-tauri/src/events.rs`.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PermissionMode, StreamLine } from "../types/claude";

export interface ClaudeInfo {
  path: string;
  version: string;
}

export interface SpawnOptions {
  cwd: string;
  permissionMode?: PermissionMode;
  model?: string;
  resume?: string;
}

export interface MessagePayload {
  sessionId: string;
  line: StreamLine;
}

export interface StderrPayload {
  sessionId: string;
  text: string;
}

export interface ExitPayload {
  sessionId: string;
  code: number | null;
}

export const claudeApi = {
  detect: () => invoke<ClaudeInfo>("detect_claude"),
  setPath: (path: string | null) => invoke<ClaudeInfo>("set_claude_path", { path }),

  startSession: (sessionId: string, options: SpawnOptions) =>
    invoke<void>("start_session", { sessionId, options }),
  sendMessage: (sessionId: string, text: string) =>
    invoke<void>("send_message", { sessionId, text }),
  stopSession: (sessionId: string) => invoke<void>("stop_session", { sessionId }),

  onMessage: (cb: (p: MessagePayload) => void): Promise<UnlistenFn> =>
    listen<MessagePayload>("claude:message", (e) => cb(e.payload)),
  onStderr: (cb: (p: StderrPayload) => void): Promise<UnlistenFn> =>
    listen<StderrPayload>("claude:stderr", (e) => cb(e.payload)),
  onExit: (cb: (p: ExitPayload) => void): Promise<UnlistenFn> =>
    listen<ExitPayload>("claude:exit", (e) => cb(e.payload)),
};
