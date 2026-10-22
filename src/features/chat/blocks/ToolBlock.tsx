import type { ChatEntry } from "../chatReducer";

type ToolEntry = Extract<ChatEntry, { kind: "tool" }>;

const MAX_RESULT_CHARS = 4000;

export function ToolBlock({ entry }: { entry: ToolEntry }) {
  const status = !entry.result ? "running" : entry.result.isError ? "error" : "done";
  const resultText = entry.result?.text ?? "";

  return (
    <details className={`entry tool tool--${status}`}>
      <summary>
        <span className="tool__name">{entry.name}</span>
        <span className="tool__summary">{summarizeInput(entry.name, entry.input)}</span>
      </summary>
      <pre className="tool__input">{JSON.stringify(entry.input, null, 2)}</pre>
      {entry.result && (
        <pre className="tool__result">
          {resultText.length > MAX_RESULT_CHARS
            ? `${resultText.slice(0, MAX_RESULT_CHARS)}\n…（已截斷 ${resultText.length - MAX_RESULT_CHARS} 字元）`
            : resultText}
        </pre>
      )}
    </details>
  );
}

/** A one-line description of the most relevant input field per tool. */
function summarizeInput(name: string, input: Record<string, unknown>): string {
  const field = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  switch (name) {
    case "Bash":
      return field("command");
    case "Read":
    case "Write":
    case "Edit":
    case "NotebookEdit":
      return field("file_path") || field("notebook_path");
    case "Glob":
    case "Grep":
      return field("pattern");
    case "WebFetch":
      return field("url");
    case "WebSearch":
      return field("query");
    case "Task":
    case "Agent":
      return field("description");
    default:
      return "";
  }
}
