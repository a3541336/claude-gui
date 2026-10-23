import { useCallback, useEffect, useState } from "react";
import { authApi, type AuthStatus } from "../../shared/api/auth";

export type AccountState =
  | { kind: "unknown" }
  | { kind: "loading" }
  | { kind: "ready"; status: AuthStatus }
  | { kind: "error"; error: string };

/** Who claude is signed in as. Only asks once claude is found. */
export function useAccount(claudeReady: boolean) {
  const [state, setState] = useState<AccountState>({ kind: "unknown" });
  /** Login or logout in progress. */
  const [pending, setPending] = useState<"login" | "logout" | null>(null);

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", status: await authApi.status() });
    } catch (e) {
      setState({ kind: "error", error: String(e) });
    }
  }, []);

  useEffect(() => {
    if (claudeReady) void refresh();
    else setState({ kind: "unknown" });
  }, [claudeReady, refresh]);

  const run = useCallback(
    async (action: "login" | "logout") => {
      setPending(action);
      try {
        await authApi[action]();
        await refresh();
      } catch (e) {
        setState({ kind: "error", error: String(e) });
      } finally {
        setPending(null);
      }
    },
    [refresh],
  );

  const loggedOut = state.kind === "ready" && !state.status.loggedIn;

  return {
    state,
    pending,
    loggedOut,
    refresh,
    login: () => run("login"),
    logout: () => run("logout"),
  };
}

export type AccountController = ReturnType<typeof useAccount>;
