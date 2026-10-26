import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";
import { claudeApi } from "../../shared/api/claude";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// `claude update` and Homebrew follow the stable channel, which trails `latest`.
const CLI_DIST_TAGS_URL = "https://registry.npmjs.org/-/package/@anthropic-ai/claude-code/dist-tags";

export type UpdateState =
  | { kind: "available"; version: string }
  | { kind: "installing"; version: string; progress?: number }
  | { kind: "failed"; version: string; error: string };

/**
 * Checks for new versions of this app and of the claude CLI on start and
 * every few hours. Nothing is installed until the user asks.
 */
export function useUpdates(claudeVersion: string | null, onClaudeUpdated: () => void) {
  const [appUpdate, setAppUpdate] = useState<Update | null>(null);
  const [app, setApp] = useState<UpdateState | null>(null);
  const [cliLatest, setCliLatest] = useState<string | null>(null);
  const [cli, setCli] = useState<UpdateState | null>(null);

  const checkAll = useCallback(async () => {
    // Failures (offline, no release yet) just mean no update to offer.
    try {
      const update = await check();
      setAppUpdate(update);
      setApp((prev) =>
        update && prev?.kind !== "installing" ? { kind: "available", version: update.version } : prev,
      );
    } catch (e) {
      console.warn("app update check failed", e);
    }
    try {
      const res = await fetch(CLI_DIST_TAGS_URL);
      if (res.ok) setCliLatest(((await res.json()) as { stable: string }).stable);
    } catch (e) {
      console.warn("claude update check failed", e);
    }
  }, []);

  useEffect(() => {
    void checkAll();
    const timer = setInterval(() => void checkAll(), CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [checkAll]);

  // Compared whenever either side changes, so updating the CLI clears it.
  useEffect(() => {
    const current = claudeVersion && parseVersion(claudeVersion);
    setCli((prev) => {
      if (prev?.kind === "installing") return prev;
      return current && cliLatest && isNewer(cliLatest, current)
        ? { kind: "available", version: cliLatest }
        : null;
    });
  }, [claudeVersion, cliLatest]);

  /** Restarts the app once installed. */
  const installApp = useCallback(async () => {
    if (!appUpdate) return;
    const { version } = appUpdate;
    setApp({ kind: "installing", version });
    try {
      let total = 0;
      let done = 0;
      await appUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          if (total > 0) setApp({ kind: "installing", version, progress: done / total });
        }
      });
      await relaunch();
    } catch (e) {
      setApp({ kind: "failed", version, error: String(e) });
    }
  }, [appUpdate]);

  const installCli = useCallback(async () => {
    if (!cli) return;
    const { version } = cli;
    setCli({ kind: "installing", version });
    try {
      await claudeApi.update();
      setCli(null);
      onClaudeUpdated();
    } catch (e) {
      setCli({ kind: "failed", version, error: String(e) });
    }
  }, [cli, onClaudeUpdated]);

  return {
    app,
    cli,
    installApp,
    installCli,
    dismissApp: () => setApp(null),
    dismissCli: () => setCli(null),
  };
}

export type UpdatesController = ReturnType<typeof useUpdates>;

/** `"2.1.309 (Claude Code)"` → `"2.1.309"`. */
function parseVersion(text: string): string | null {
  return text.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
}

function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
