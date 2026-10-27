import { useCallback, useEffect, useState } from "react";
import { claudeApi, type ClaudeInfo } from "../../shared/api/claude";
import { loadString, saveString } from "../../shared/storage";

const PATH_KEY = "flowloom.claudePath";

export type ClaudeStatus =
  | { kind: "checking" }
  | { kind: "ready"; info: ClaudeInfo }
  | { kind: "missing"; error: string };

export function useClaudeStatus() {
  const [status, setStatus] = useState<ClaudeStatus>({ kind: "checking" });

  /** `undefined` re-detects; a string or `null` sets or clears the custom path. */
  const check = useCallback(async (path?: string | null) => {
    setStatus({ kind: "checking" });
    if (path !== undefined) saveString(PATH_KEY, path);
    const saved = path === undefined ? loadString(PATH_KEY) : path;
    try {
      const info = saved !== null ? await claudeApi.setPath(saved) : await claudeApi.detect();
      setStatus({ kind: "ready", info });
    } catch (e) {
      setStatus({ kind: "missing", error: String(e) });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { status, check };
}

export type ClaudeStatusController = ReturnType<typeof useClaudeStatus>;
