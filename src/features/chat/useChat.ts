import { useCallback, useEffect, useReducer, useRef } from "react";
import { claudeApi } from "../../shared/api/claude";
import type { PermissionMode } from "../../shared/types/claude";
import { chatReducer, initialChatState, type ChatSnapshot } from "./chatReducer";

interface Options {
  cwd: string | null;
  permissionMode: PermissionMode;
  /** `--model` value; empty uses claude's default. */
  model: string;
}

/**
 * Owns one claude process at a time. The process is started lazily on the
 * first message and restarted with `--resume` after a stop or setting change.
 * Changing `cwd` does not reset the conversation; callers pair it with
 * `newChat` or `load`.
 */
export function useChat({ cwd, permissionMode, model }: Options) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  // Events from any other (e.g. just-stopped) process are ignored.
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    const subscriptions = [
      claudeApi.onMessage((p) => {
        if (p.sessionId === sessionRef.current) dispatch({ type: "line", line: p.line });
      }),
      claudeApi.onStderr((p) => {
        if (p.sessionId === sessionRef.current) dispatch({ type: "stderr", text: p.text });
      }),
      claudeApi.onExit((p) => {
        if (p.sessionId !== sessionRef.current) return;
        sessionRef.current = null;
        dispatch({ type: "exited", code: p.code });
      }),
    ];
    return () => {
      for (const sub of subscriptions) void sub.then((unlisten) => unlisten());
    };
  }, []);

  /** Kills the current process without waiting for its exit event. */
  const detach = useCallback(() => {
    const id = sessionRef.current;
    sessionRef.current = null;
    if (id) void claudeApi.stopSession(id);
    return id !== null;
  }, []);

  // New settings need a new process; the conversation resumes.
  const firstSettings = useRef(true);
  useEffect(() => {
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    if (detach()) dispatch({ type: "detached", notice: "設定已變更，下次送出時套用" });
  }, [permissionMode, model, detach]);

  useEffect(
    () => () => {
      detach();
    },
    [detach],
  );

  const send = useCallback(
    async (text: string) => {
      if (!cwd || !text.trim()) return;
      dispatch({ type: "userSent", text });
      try {
        let id = sessionRef.current;
        if (!id) {
          id = crypto.randomUUID();
          sessionRef.current = id;
          await claudeApi.startSession(id, {
            cwd,
            permissionMode,
            model: model || undefined,
            resume: state.claudeSessionId ?? undefined,
          });
        }
        await claudeApi.sendMessage(id, text);
      } catch (e) {
        detach();
        dispatch({ type: "error", text: String(e) });
      }
    },
    [cwd, permissionMode, model, state.claudeSessionId, detach],
  );

  const stop = useCallback(() => {
    const id = sessionRef.current;
    if (id) void claudeApi.stopSession(id);
  }, []);

  const newChat = useCallback(() => {
    detach();
    dispatch({ type: "reset" });
  }, [detach]);

  /** Replaces the current conversation; the next message resumes it. */
  const load = useCallback(
    (snapshot: ChatSnapshot) => {
      detach();
      dispatch({ type: "load", snapshot });
    },
    [detach],
  );

  return { state, send, stop, newChat, load };
}

export type ChatController = ReturnType<typeof useChat>;
