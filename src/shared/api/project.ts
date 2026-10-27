// The project's CLAUDE.md, read and written by the Rust backend. A null `cwd`
// means chats without a project, which share one of their own.
// Command names must match `src-tauri/src/lib.rs`.

import { invoke } from "@tauri-apps/api/core";

export const projectApi = {
  /** null when there is no CLAUDE.md yet. */
  readClaudeMd: (cwd: string | null) => invoke<string | null>("read_claude_md", { cwd }),
  writeClaudeMd: (cwd: string | null, content: string) =>
    invoke<void>("write_claude_md", { cwd, content }),
  /** Adds `note` as a list item at the end. */
  appendClaudeMd: (cwd: string | null, note: string) =>
    invoke<void>("append_claude_md", { cwd, note }),
};
