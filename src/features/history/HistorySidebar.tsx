import { ask } from "@tauri-apps/plugin-dialog";
import { CircleAlert, LoaderCircle, Plus, Trash2 } from "lucide-react";
import type { ConversationStatus } from "../chat/useChat";
import type { ConversationMeta } from "./useHistory";

interface Props {
  items: ConversationMeta[];
  error: string | null;
  activeId: string | null;
  /** Conversations running or waiting for an answer, possibly in the background. */
  statuses: Record<string, ConversationStatus>;
  cwd: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** null starts a chat without a project. */
  onNewChatIn: (cwd: string | null) => void;
}

/** Conversations grouped by the directory they ran in, most recent first. */
export function HistorySidebar({
  items,
  error,
  activeId,
  statuses,
  cwd,
  onOpen,
  onDelete,
  onNewChatIn,
}: Props) {
  const groups = groupByCwd(items);

  const confirmDelete = async (item: ConversationMeta) => {
    if (await ask(`刪除「${item.title}」？`, { title: "刪除對話", kind: "warning" })) {
      onDelete(item.id);
    }
  };

  return (
    <section className="history">
      <div className="history__header">歷史對話</div>
      {error && <p className="history__error">{error}</p>}
      {groups.length === 0 && <p className="history__empty">尚無對話紀錄</p>}
      {groups.map(([dir, convs]) => (
        <section key={dir} className="history__group">
          <div
            className={`history__dir${dir === cwd ? " history__dir--current" : ""}`}
            title={dir ?? "不指定工作目錄的對話"}
          >
            <span className="history__dir-name">{dir ? baseName(dir) : "閒聊"}</span>
            <span className="history__dir-path">{dir ?? "不指定工作目錄"}</span>
            <button
              className="history__icon-button"
              title={dir ? "在此路徑開新對話" : "開新閒聊"}
              aria-label={dir ? "在此路徑開新對話" : "開新閒聊"}
              onClick={() => onNewChatIn(dir)}
            >
              <Plus size={14} />
            </button>
          </div>
          <ul>
            {convs.map((item) => (
              <li
                key={item.id}
                className={`history__item${item.id === activeId ? " history__item--active" : ""}`}
                onClick={() => onOpen(item.id)}
                title={item.title}
              >
                {statuses[item.id] === "running" && (
                  <LoaderCircle size={12} className="history__status history__status--running">
                    <title>執行中</title>
                  </LoaderCircle>
                )}
                {statuses[item.id] === "waiting" && (
                  <CircleAlert size={12} className="history__status history__status--waiting">
                    <title>等待你的回覆</title>
                  </CircleAlert>
                )}
                <span className="history__title">{item.title}</span>
                <span className="history__time">{formatTime(item.updatedAt)}</span>
                <button
                  className="history__icon-button history__delete"
                  title="刪除"
                  aria-label="刪除"
                  onClick={(e) => {
                    e.stopPropagation();
                    void confirmDelete(item);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** Keeps the input order, so groups are ordered by their most recent conversation. */
function groupByCwd(items: ConversationMeta[]): Array<[string | null, ConversationMeta[]]> {
  const groups = new Map<string | null, ConversationMeta[]>();
  for (const item of items) {
    const group = groups.get(item.cwd);
    if (group) group.push(item);
    else groups.set(item.cwd, [item]);
  }
  return [...groups];
}

function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function formatTime(ms: number): string {
  const date = new Date(ms);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
    : date.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
}
