import { useCallback, useEffect, useReducer, useRef } from "react";
import { claudeApi } from "../../shared/api/claude";
import type { PermissionMode, PermissionResponse } from "../../shared/types/claude";
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

  const deliver = useCallback(
    async (text: string, dir: string, resume: string | null) => {
      dispatch({ type: "userSent", text });
      try {
        let id = sessionRef.current;
        if (!id) {
          id = crypto.randomUUID();
          sessionRef.current = id;
          await claudeApi.startSession(id, {
            cwd: dir,
            permissionMode,
            model: model || undefined,
            resume: resume ?? undefined,
          });
        }
        await claudeApi.sendMessage(id, text);
      } catch (e) {
        detach();
        dispatch({ type: "error", text: String(e) });
      }
    },
    [permissionMode, model, detach],
  );

  const send = useCallback(
    async (text: string) => {
      if (!cwd || !text.trim()) return;
      await deliver(text, cwd, state.claudeSessionId);
    },
    [cwd, state.claudeSessionId, deliver],
  );

  /**
   * Starts a new conversation in `dir` with `text` as its first message.
   * `dir` is passed in because a `cwd` change made alongside hasn't reached this hook yet.
   */
  const startWith = useCallback(
    async (text: string, dir: string) => {
      detach();
      dispatch({ type: "reset" });
      await deliver(text, dir, null);
    },
    [detach, deliver],
  );

  const stop = useCallback(() => {
    const id = sessionRef.current;
    if (id) void claudeApi.stopSession(id);
  }, []);

  /** Answers a permission prompt from the running process. */
  const respond = useCallback(async (requestId: string, response: PermissionResponse) => {
    const id = sessionRef.current;
    if (!id) return;
    dispatch({ type: "permissionAnswered", requestId, allowed: response.behavior === "allow" });
    try {
      await claudeApi.respondToRequest(id, requestId, response);
    } catch (e) {
      dispatch({ type: "error", text: String(e) });
    }
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

  return { state, send, startWith, stop, respond, newChat, load };
}

export type ChatController = ReturnType<typeof useChat>;
