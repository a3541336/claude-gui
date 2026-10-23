// Sign-in state of the claude CLI. Command names must match `src-tauri/src/lib.rs`.

import { invoke } from "@tauri-apps/api/core";

/** `claude auth status --json`; fields other than `loggedIn` depend on how claude signed in. */
export interface AuthStatus {
  loggedIn: boolean;
  /** e.g. `claude.ai` or an API key source. */
  authMethod?: string;
  email?: string;
  orgName?: string;
  /** e.g. `pro`, `max`, `team`. */
  subscriptionType?: string;
}

export const authApi = {
  status: () => invoke<AuthStatus>("auth_status"),
  login: () => invoke<void>("auth_login"),
  logout: () => invoke<void>("auth_logout"),
};
