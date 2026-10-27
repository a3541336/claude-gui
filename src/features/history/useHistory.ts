import { useCallback, useEffect, useRef, useState } from "react";
import { historyApi, type ConversationMeta } from "../../shared/api/history";
import type { ChatEntry, ChatSnapshot } from "../chat/chatReducer";
import type { Conversation } from "../chat/chatsReducer";

export type { ConversationMeta };

/** Saved conversations, persisted to files by the backend. */
export function useHistory(conversations: Record<string, Conversation>) {
  const [items, setItems] = useState<ConversationMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Backend calls run one at a time, so an older save never lands after a
  // newer one and a load always sees the latest save.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const serial = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.current.then(task);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  useEffect(() => {
    serial(historyApi.list).then(
      // Conversations saved before the list arrived are newer than the disk copy.
      (saved) =>
        setItems((prev) =>
          sortItems([...prev, ...saved.filter((s) => !prev.some((p) => p.id === s.id))]),
        ),
      (e) => setError(String(e)),
    );
  }, [serial]);

  // Save each open conversation whenever it changes; they can run side by side.
  const lastSaved = useRef(new Map<string, Conversation["chat"]>());
  useEffect(() => {
    for (const { cwd, chat } of Object.values(conversations)) {
      const { conversationId, updatedAt, entries, claudeSessionId, model } = chat;
      if (updatedAt === null || entries.length === 0) continue;
      const prev = lastSaved.current.get(conversationId);
      if (
        prev?.entries === entries &&
        prev.updatedAt === updatedAt &&
        prev.claudeSessionId === claudeSessionId &&
        prev.model === model
      ) {
        continue;
      }
      lastSaved.current.set(conversationId, chat);
      const meta: ConversationMeta = {
        id: conversationId,
        title: titleOf(entries),
        cwd,
        updatedAt,
        claudeSessionId,
        model,
      };
      setItems((prev) => sortItems([meta, ...prev.filter((item) => item.id !== meta.id)]));
      serial(() => historyApi.save(meta, entries)).then(
        () => setError(null),
        (e) => setError(`對話紀錄儲存失敗：${e}`),
      );
    }
    for (const id of lastSaved.current.keys()) {
      if (!conversations[id]) lastSaved.current.delete(id);
    }
  }, [conversations, serial]);

  const load = useCallback(
    async (id: string): Promise<{ cwd: string | null; snapshot: ChatSnapshot } | null> => {
      const meta = items.find((item) => item.id === id);
      if (!meta) return null;
      try {
        const saved = await serial(() => historyApi.load<ChatEntry[]>(id));
        return {
          cwd: meta.cwd,
          snapshot: {
            conversationId: meta.id,
            updatedAt: meta.updatedAt,
            entries: saved,
            claudeSessionId: meta.claudeSessionId,
            model: meta.model,
          },
        };
      } catch (e) {
        setError(`對話紀錄讀取失敗：${e}`);
        return null;
      }
    },
    [items, serial],
  );

  const remove = useCallback(
    (id: string) => {
      lastSaved.current.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      serial(() => historyApi.delete(id)).catch((e) => setError(`對話紀錄刪除失敗：${e}`));
    },
    [serial],
  );

  return { items, error, load, remove };
}

function sortItems(items: ConversationMeta[]): ConversationMeta[] {
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

function titleOf(entries: ChatEntry[]): string {
  const first = entries.find((e) => e.kind === "user");
  const line = first?.text.trim().split("\n")[0] ?? "";
  return line.length > 60 ? `${line.slice(0, 60)}…` : line || "（無標題）";
}

export type HistoryController = ReturnType<typeof useHistory>;
