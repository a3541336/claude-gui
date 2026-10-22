import type { ChatEntry } from "../chatReducer";

type NoticeEntry = Extract<ChatEntry, { kind: "notice" }>;

export function NoticeBlock({ entry }: { entry: NoticeEntry }) {
  return <div className={`entry notice notice--${entry.level}`}>{entry.text}</div>;
}
