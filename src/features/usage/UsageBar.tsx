import type { RateLimitWindows } from "../../shared/types/claude";
import type { ChatState } from "../chat/chatReducer";
import type { RateLimitWindow } from "../../shared/types/claude";

type Props = Pick<ChatState, "model" | "contextTokens" | "contextWindow"> & {
  rateLimits: RateLimitWindows | null;
};

/** Model in use, context window fill and subscription usage (5-hour and 7-day windows). */
export function UsageBar({ model, contextTokens, contextWindow, rateLimits }: Props) {
  const fiveHour = current(rateLimits?.five_hour);
  const sevenDay = current(rateLimits?.seven_day);

  return (
    <footer className="usage-bar">
      {model && (
        <span className="usage-bar__item usage-bar__model" title="claude 回報的目前模型">
          {model}
        </span>
      )}
      <span className="usage-bar__item" title="目前對話佔用的上下文">
        上下文
        {contextTokens === null ? (
          " —"
        ) : contextWindow ? (
          <>
            <Meter fraction={contextTokens / contextWindow} />
            {formatTokens(contextTokens)} / {formatTokens(contextWindow)}
          </>
        ) : (
          ` ${formatTokens(contextTokens)}`
        )}
      </span>
      {fiveHour && <WindowItem label="5h" window={fiveHour} />}
      {sevenDay && <WindowItem label="7d" window={sevenDay} />}
    </footer>
  );
}

function WindowItem({ label, window }: { label: string; window: RateLimitWindow }) {
  return (
    <span className="usage-bar__item" title={`${formatReset(window.resetsAt)} 重置`}>
      {label}
      <Meter fraction={window.utilization} />
      <span className="usage-bar__reset">{formatReset(window.resetsAt)}</span>
    </span>
  );
}

function Meter({ fraction }: { fraction: number }) {
  const percent = Math.round(fraction * 100);
  const level = percent >= 90 ? "high" : percent >= 70 ? "mid" : "low";
  return (
    <>
      <span className="usage-bar__meter">
        <span
          className={`usage-bar__fill usage-bar__fill--${level}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </span>
      <span className="usage-bar__percent">{percent}%</span>
    </>
  );
}

/** Windows past their reset time no longer describe current usage. */
function current(window: RateLimitWindow | undefined): RateLimitWindow | null {
  return window && window.resetsAt * 1000 > Date.now() ? window : null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatReset(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const time = date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
