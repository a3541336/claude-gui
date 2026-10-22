import { useEffect, useRef } from "react";
import { Markdown } from "../../shared/components/Markdown";
import { NoticeBlock } from "./blocks/NoticeBlock";
import { PermissionBlock, type RespondFn } from "./blocks/PermissionBlock";
import { QuestionBlock } from "./blocks/QuestionBlock";
import { ResultBlock } from "./blocks/ResultBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolBlock } from "./blocks/ToolBlock";
import type { ChatEntry } from "./chatReducer";

interface Props {
  entries: ChatEntry[];
  busy: boolean;
  onRespond: RespondFn;
}

export function MessageList({ entries, busy, onRespond }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, busy]);

  return (
    <div className="message-list">
      {entries.length === 0 && <p className="message-list__empty">輸入訊息開始對話</p>}
      {entries.map((entry) => (
        <EntryView key={entry.id} entry={entry} onRespond={onRespond} />
      ))}
      {busy && <div className="message-list__busy">Claude 思考中…</div>}
      <div ref={bottomRef} />
    </div>
  );
}

function EntryView({ entry, onRespond }: { entry: ChatEntry; onRespond: RespondFn }) {
  switch (entry.kind) {
    case "user":
      return <div className="entry entry--user">{entry.text}</div>;
    case "text":
      return (
        <div className="entry entry--assistant">
          <Markdown text={entry.text} />
        </div>
      );
    case "thinking":
      return <ThinkingBlock text={entry.text} />;
    case "tool":
      return <ToolBlock entry={entry} />;
    case "result":
      return <ResultBlock entry={entry} />;
    case "notice":
      return <NoticeBlock entry={entry} />;
    case "permission":
      return entry.request.tool_name === "AskUserQuestion" ? (
        <QuestionBlock entry={entry} onRespond={onRespond} />
      ) : (
        <PermissionBlock entry={entry} onRespond={onRespond} />
      );
  }
}
