import { SendHorizontal, X } from "lucide-react";

interface Props {
  items: string[];
  onRemove: (index: number) => void;
  /** Present once the turn was interrupted, so the queue no longer goes out by itself. */
  onSendNow?: () => void;
}

/** Messages typed while claude was busy; they go out together when the turn ends. */
export function QueuedMessages({ items, onRemove, onSendNow }: Props) {
  return (
    <ul className="queue" aria-label="排隊中的訊息">
      {items.map((text, i) => (
        <li key={i} className="queue__item" title={text}>
          <span className="queue__text">排隊中：{text}</span>
          <button
            className="button--icon"
            title="取消這則"
            aria-label="取消這則"
            onClick={() => onRemove(i)}
          >
            <X size={12} />
          </button>
        </li>
      ))}
      {onSendNow && (
        <li className="queue__paused">
          已中斷，排隊的訊息會跟下一則一起送出
          <button className="button--icon" onClick={onSendNow}>
            <SendHorizontal size={12} />
            現在送出
          </button>
        </li>
      )}
    </ul>
  );
}
