// Typed bridge to the Rust backend. Command and event names must match
// `src-tauri/src/lib.rs` and `src-tauri/src/events.rs`.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PermissionMode, PermissionResponse, StreamLine } from "../types/claude";

export interface ClaudeInfo {
  path: string;
  version: string;
}

export interface SpawnOptions {
  /** Omitted for a chat without a project; the backend picks a directory of its own. */
  cwd?: string;
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
  /** Runs `claude update` (`brew upgrade` for Homebrew installs); resolves with its output. */
  update: () => invoke<string>("update_claude"),
  /** Runs the official installer; resolves with its output. */
  install: () => invoke<string>("install_claude"),

  startSession: (sessionId: string, options: SpawnOptions) =>
    invoke<void>("start_session", { sessionId, options }),
  sendMessage: (sessionId: string, text: string) =>
    invoke<void>("send_message", { sessionId, text }),
  respondToRequest: (sessionId: string, requestId: string, response: PermissionResponse) =>
    invoke<void>("respond_to_request", { sessionId, requestId, response }),
  /** Switches a running process's mode at once; resolves with the control request id. */
  setPermissionMode: (sessionId: string, mode: PermissionMode) =>
    invoke<string>("set_permission_mode", { sessionId, mode }),
  stopSession: (sessionId: string) => invoke<void>("stop_session", { sessionId }),

  onMessage: (cb: (p: MessagePayload) => void): Promise<UnlistenFn> =>
    listen<MessagePayload>("claude:message", (e) => cb(e.payload)),
  onStderr: (cb: (p: StderrPayload) => void): Promise<UnlistenFn> =>
    listen<StderrPayload>("claude:stderr", (e) => cb(e.payload)),
  onExit: (cb: (p: ExitPayload) => void): Promise<UnlistenFn> =>
    listen<ExitPayload>("claude:exit", (e) => cb(e.payload)),
};
