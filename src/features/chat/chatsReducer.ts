// Every open conversation, each with its own claude process, plus which one is shown.

import type { RateLimitEventLine, RateLimitWindows } from "../../shared/types/claude";
import { chatReducer, createChatState, type ChatAction, type ChatSnapshot, type ChatState } from "./chatReducer";

export interface Conversation {
  /** Where claude runs once the conversation has started; null is a chat without a project. */
  cwd: string | null;
  chat: ChatState;
  /** Messages typed while claude was busy, sent together when the turn ends. */
  queued: string[];
  /** Set when the turn was interrupted; the queue then waits for the next send. */
  queuePaused: boolean;
}

export interface ChatsState {
  activeId: string;
  conversations: Record<string, Conversation>;
  /** Account-wide, so they come from whichever conversation reported last. */
  rateLimits: RateLimitWindows | null;
}

export type ChatsAction =
  | { type: "chat"; id: string; action: ChatAction }
  | { type: "sent"; id: string; text: string; cwd: string | null }
  | { type: "open"; id: string; cwd?: string | null; snapshot?: ChatSnapshot }
  | { type: "activate"; id: string }
  | { type: "close"; id: string }
  | { type: "enqueue"; id: string; text: string }
  | { type: "unqueue"; id: string; index: number }
  | { type: "clearQueue"; id: string };

export function createChatsState(): ChatsState {
  const id = crypto.randomUUID();
  return { activeId: id, conversations: { [id]: newConversation(id) }, rateLimits: null };
}

function newConversation(id: string, cwd?: string | null, snapshot?: ChatSnapshot): Conversation {
  return { cwd: cwd ?? null, chat: createChatState(id, snapshot), queued: [], queuePaused: false };
}

/** Busy, or holding messages that still have to go out. */
export function isActive(conv: Conversation): boolean {
  return conv.chat.busy || conv.queued.length > 0;
}

export function chatsReducer(state: ChatsState, action: ChatsAction): ChatsState {
  switch (action.type) {
    case "chat": {
      const { line } = action.action.type === "line" ? action.action : { line: null };
      if (line?.type === "rate_limit_event") {
        const windows = (line as RateLimitEventLine).rate_limit_info.unifiedWindows;
        return windows ? { ...state, rateLimits: windows } : state;
      }
      return update(state, action.id, (conv) => {
        const interrupted = action.action.type === "exited" || action.action.type === "error";
        return {
          ...conv,
          chat: chatReducer(conv.chat, action.action),
          queuePaused: conv.queuePaused || (interrupted && conv.queued.length > 0),
        };
      });
    }
    case "sent":
      return update(state, action.id, (conv) => ({
        ...conv,
        cwd: action.cwd,
        chat: chatReducer(conv.chat, { type: "userSent", text: action.text }),
      }));
    case "open":
      return {
        ...state,
        activeId: action.id,
        conversations: {
          ...state.conversations,
          [action.id]: newConversation(action.id, action.cwd, action.snapshot),
        },
      };
    case "activate":
      return state.conversations[action.id] ? { ...state, activeId: action.id } : state;
    case "close": {
      const { [action.id]: _closed, ...conversations } = state.conversations;
      return { ...state, conversations };
    }
    case "enqueue":
      return update(state, action.id, (conv) => ({ ...conv, queued: [...conv.queued, action.text] }));
    case "unqueue":
      return update(state, action.id, (conv) => {
        const queued = conv.queued.filter((_, i) => i !== action.index);
        return { ...conv, queued, queuePaused: conv.queuePaused && queued.length > 0 };
      });
    case "clearQueue":
      return update(state, action.id, (conv) => ({ ...conv, queued: [], queuePaused: false }));
  }
}

function update(state: ChatsState, id: string, fn: (conv: Conversation) => Conversation): ChatsState {
  const conv = state.conversations[id];
  if (!conv) return state;
  return { ...state, conversations: { ...state.conversations, [id]: fn(conv) } };
}
