// Saved conversations, stored as files by the Rust backend.
// Command names must match `src-tauri/src/lib.rs`.

import { invoke } from "@tauri-apps/api/core";

export interface ConversationMeta {
  id: string;
  title: string;
  /** Working directory the conversation ran in; claude can only resume it from there. */
  cwd: string;
  /** Time of the last user message, in ms. */
  updatedAt: number;
  claudeSessionId: string | null;
  model: string | null;
}

export const historyApi = {
  list: () => invoke<ConversationMeta[]>("list_history"),
  /** `entries` is stored as-is; the backend doesn't read it. */
  save: (meta: ConversationMeta, entries: unknown) => invoke<void>("save_history", { meta, entries }),
  load: <T>(id: string) => invoke<T>("load_history", { id }),
  delete: (id: string) => invoke<void>("delete_history", { id }),
};
