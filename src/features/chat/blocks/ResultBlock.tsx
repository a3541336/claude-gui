import type { ChatEntry } from "../chatReducer";

type ResultEntry = Extract<ChatEntry, { kind: "result" }>;

export function ResultBlock({ entry }: { entry: ResultEntry }) {
  const parts = [
    entry.isError ? "執行失敗" : "完成",
    entry.durationMs !== undefined && `${(entry.durationMs / 1000).toFixed(1)} 秒`,
    entry.numTurns !== undefined && `${entry.numTurns} 回合`,
    entry.costUsd !== undefined && `$${entry.costUsd.toFixed(4)}`,
  ].filter(Boolean);

  return (
    <div className={`entry result ${entry.isError ? "result--error" : ""}`}>{parts.join(" · ")}</div>
  );
}
