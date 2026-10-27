import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import { claudeApi } from "../../shared/api/claude";
import type { PermissionMode, PermissionResponse } from "../../shared/types/claude";
import type { ChatAction, ChatSnapshot } from "./chatReducer";
import { chatsReducer, createChatsState, isActive } from "./chatsReducer";

interface Options {
  /** Directory for a conversation that hasn't sent anything yet. */
  cwd: string | null;
  permissionMode: PermissionMode;
  /** `--model` value; empty uses claude's default. */
  model: string;
}

/** What a conversation in the sidebar is doing. */
export type ConversationStatus = "running" | "waiting";

/**
 * Owns one claude process per open conversation, so several can run at once.
 * A process is started lazily on the first message and restarted with
 * `--resume` after a stop or setting change. Only the shown conversation and
 * those still working stay open; switching away from an idle one closes it,
 * and it is reloaded from history when opened again.
 */
export function useChat({ cwd, permissionMode, model }: Options) {
  const [state, dispatch] = useReducer(chatsReducer, undefined, createChatsState);
  // Callbacks read the latest state without being recreated on every event.
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });
  // Conversation id → id of its claude process. Events from any other
  // (e.g. just-stopped) process are ignored.
  const processes = useRef(new Map<string, string>());
  // Processes started before a settings change; replaced once their turn ends.
  const stale = useRef(new Set<string>());

  const chatAction = useCallback(
    (id: string, action: ChatAction) => dispatch({ type: "chat", id, action }),
    [],
  );

  /** Kills the conversation's process without waiting for its exit event. */
  const detach = useCallback((id: string) => {
    const pid = processes.current.get(id);
    processes.current.delete(id);
    stale.current.delete(id);
    if (pid) void claudeApi.stopSession(pid);
    return pid !== undefined;
  }, []);

  useEffect(() => {
    const ownerOf = (pid: string) => {
      for (const [id, p] of processes.current) if (p === pid) return id;
      return null;
    };
    const subscriptions = [
      claudeApi.onMessage((p) => {
        const id = ownerOf(p.sessionId);
        if (!id) return;
        chatAction(id, { type: "line", line: p.line });
        if (p.line.type === "result" && stale.current.has(id)) {
          detach(id);
          chatAction(id, { type: "detached", notice: "設定已變更，下次送出時套用" });
        }
      }),
      claudeApi.onStderr((p) => {
        const id = ownerOf(p.sessionId);
        if (id) chatAction(id, { type: "stderr", text: p.text });
      }),
      claudeApi.onExit((p) => {
        const id = ownerOf(p.sessionId);
        if (!id) return;
        processes.current.delete(id);
        stale.current.delete(id);
        chatAction(id, { type: "exited", code: p.code });
      }),
    ];
    return () => {
      for (const sub of subscriptions) void sub.then((unlisten) => unlisten());
    };
  }, [chatAction, detach]);

  // New settings need new processes; conversations resume. A running turn finishes first.
  const firstSettings = useRef(true);
  useEffect(() => {
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    for (const id of [...processes.current.keys()]) {
      if (stateRef.current.conversations[id]?.chat.busy) {
        stale.current.add(id);
      } else {
        detach(id);
        chatAction(id, { type: "detached", notice: "設定已變更，下次送出時套用" });
      }
    }
  }, [permissionMode, model, detach, chatAction]);

  useEffect(
    () => () => {
      for (const id of [...processes.current.keys()]) detach(id);
    },
    [detach],
  );

  const deliver = useCallback(
    async (id: string, text: string, dir: string, resume: string | null) => {
      dispatch({ type: "sent", id, text, cwd: dir });
      try {
        let pid = processes.current.get(id);
        if (!pid) {
          pid = crypto.randomUUID();
          processes.current.set(id, pid);
          await claudeApi.startSession(pid, {
            cwd: dir,
            permissionMode,
            model: model || undefined,
            resume: resume ?? undefined,
          });
        }
        await claudeApi.sendMessage(pid, text);
      } catch (e) {
        detach(id);
        chatAction(id, { type: "error", text: String(e) });
      }
    },
    [permissionMode, model, detach, chatAction],
  );

  // Send what was queued once its conversation's turn ends.
  useEffect(() => {
    for (const [id, conv] of Object.entries(state.conversations)) {
      if (conv.chat.busy || conv.queued.length === 0 || conv.queuePaused || !conv.cwd) continue;
      dispatch({ type: "clearQueue", id });
      void deliver(id, conv.queued.join("\n\n"), conv.cwd, conv.chat.claudeSessionId);
    }
  }, [state.conversations, deliver]);

  /**
   * Sends to the shown conversation, or queues the message while claude is busy.
   * Anything still queued goes out with it; empty `text` sends just the queue.
   */
  const send = useCallback(
    async (text: string) => {
      const { activeId: id, conversations } = stateRef.current;
      const conv = conversations[id];
      const messages = [...conv.queued, text].filter((m) => m.trim());
      if (messages.length === 0) return;
      if (conv.chat.busy) {
        if (!text.trim()) return;
        dispatch({ type: "enqueue", id, text });
        return;
      }
      const dir = conv.cwd ?? cwd;
      if (!dir) return;
      if (conv.queued.length > 0) dispatch({ type: "clearQueue", id });
      await deliver(id, messages.join("\n\n"), dir, conv.chat.claudeSessionId);
    },
    [cwd, deliver],
  );

  /** Closes the shown conversation if nothing in it is still running. */
  const leave = useCallback(() => {
    const { activeId, conversations } = stateRef.current;
    const conv = conversations[activeId];
    if (conv && !isActive(conv)) {
      detach(activeId);
      dispatch({ type: "close", id: activeId });
    }
  }, [detach]);

  const newChat = useCallback(() => {
    leave();
    dispatch({ type: "open", id: crypto.randomUUID() });
  }, [leave]);

  /** Shows a conversation restored from history; the next message resumes it. */
  const load = useCallback(
    (snapshot: ChatSnapshot, dir: string) => {
      leave();
      dispatch({ type: "open", id: snapshot.conversationId, cwd: dir, snapshot });
    },
    [leave],
  );

  /** Shows a conversation that is still open, e.g. one running in the background. */
  const activate = useCallback(
    (id: string) => {
      if (id === stateRef.current.activeId) return;
      leave();
      dispatch({ type: "activate", id });
    },
    [leave],
  );

  /**
   * Starts a new conversation in `dir` with `text` as its first message.
   * `dir` is passed in because a `cwd` change made alongside hasn't reached this hook yet.
   */
  const startWith = useCallback(
    async (text: string, dir: string) => {
      leave();
      const id = crypto.randomUUID();
      dispatch({ type: "open", id, cwd: dir });
      await deliver(id, text, dir, null);
    },
    [leave, deliver],
  );

  /** Stops and forgets a conversation, e.g. when it is deleted. */
  const close = useCallback(
    (id: string) => {
      detach(id);
      if (id === stateRef.current.activeId) dispatch({ type: "open", id: crypto.randomUUID() });
      dispatch({ type: "close", id });
    },
    [detach],
  );

  const stop = useCallback(() => {
    const pid = processes.current.get(stateRef.current.activeId);
    if (pid) void claudeApi.stopSession(pid);
  }, []);

  const stopAll = useCallback(() => {
    for (const pid of processes.current.values()) void claudeApi.stopSession(pid);
  }, []);

  /** Answers a permission prompt from the shown conversation's process. */
  const respond = useCallback(
    async (requestId: string, response: PermissionResponse) => {
      const id = stateRef.current.activeId;
      const pid = processes.current.get(id);
      if (!pid) return;
      chatAction(id, {
        type: "permissionAnswered",
        requestId,
        allowed: response.behavior === "allow",
      });
      try {
        await claudeApi.respondToRequest(pid, requestId, response);
      } catch (e) {
        chatAction(id, { type: "error", text: String(e) });
      }
    },
    [chatAction],
  );

  const removeQueued = useCallback(
    (index: number) => dispatch({ type: "unqueue", id: stateRef.current.activeId, index }),
    [],
  );

  const statuses = useMemo(() => {
    const result: Record<string, ConversationStatus> = {};
    for (const [id, conv] of Object.entries(state.conversations)) {
      const waiting = conv.chat.entries.some((e) => e.kind === "permission" && e.status === "pending");
      if (waiting) result[id] = "waiting";
      else if (conv.chat.busy) result[id] = "running";
    }
    return result;
  }, [state.conversations]);

  const active = state.conversations[state.activeId];
  return {
    state: active.chat,
    queued: active.queued,
    queuePaused: active.queuePaused,
    conversations: state.conversations,
    rateLimits: state.rateLimits,
    statuses,
    anyBusy: Object.keys(statuses).length > 0,
    send,
    startWith,
    stop,
    stopAll,
    respond,
    newChat,
    load,
    activate,
    close,
    removeQueued,
  };
}

export type ChatController = ReturnType<typeof useChat>;
