import { useState } from "react";
import { STATUS_TEXT, type PermissionEntry, type RespondFn } from "./PermissionBlock";

interface Question {
  question: string;
  header?: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

/**
 * AskUserQuestion arrives as a permission prompt; allowing it with `answers`
 * (question text -> answer, multi-select joined by ", ") is how the user replies.
 */
export function QuestionBlock({ entry, onRespond }: { entry: PermissionEntry; onRespond: RespondFn }) {
  const { input } = entry.request;
  const questions = Array.isArray(input.questions) ? (input.questions as Question[]) : [];
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});

  const answerOf = (q: Question) => {
    const typed = other[q.question]?.trim() ?? "";
    const picked = selected[q.question] ?? [];
    if (!q.multiSelect) return typed || picked[0] || "";
    return [...picked, typed].filter(Boolean).join(", ");
  };

  const toggle = (q: Question, label: string) =>
    setSelected((prev) => {
      const current = prev[q.question] ?? [];
      const next = q.multiSelect
        ? current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label]
        : [label];
      return { ...prev, [q.question]: next };
    });

  const submit = () =>
    onRespond(entry.id, {
      behavior: "allow",
      updatedInput: {
        ...input,
        answers: Object.fromEntries(questions.map((q) => [q.question, answerOf(q)])),
      },
    });

  const pending = entry.status === "pending";
  const complete = questions.every((q) => answerOf(q) !== "");

  return (
    <div className={`entry permission permission--${entry.status}`}>
      <div className="permission__title">Claude 想問你</div>
      {questions.map((q) => (
        <fieldset key={q.question} className="question" disabled={!pending}>
          <legend>
            {q.header && <span className="question__header">{q.header}</span>}
            {q.question}
            {q.multiSelect && <span className="question__hint">（可複選）</span>}
          </legend>
          <div className="question__options">
            {q.options.map((option) => (
              <button
                key={option.label}
                className="question__option"
                aria-pressed={(selected[q.question] ?? []).includes(option.label)}
                onClick={() => toggle(q, option.label)}
                title={option.description}
              >
                {option.label}
                {option.description && (
                  <span className="question__description">{option.description}</span>
                )}
              </button>
            ))}
          </div>
          <input
            className="question__other"
            placeholder="其他（自行輸入）"
            value={other[q.question] ?? ""}
            onChange={(e) => setOther((prev) => ({ ...prev, [q.question]: e.target.value }))}
          />
        </fieldset>
      ))}
      {pending ? (
        <div className="permission__actions">
          <button className="permission__primary" onClick={submit} disabled={!complete}>
            送出回答
          </button>
          <button
            onClick={() =>
              onRespond(entry.id, { behavior: "deny", message: "使用者略過了這些問題" })
            }
          >
            略過
          </button>
        </div>
      ) : (
        <div className="permission__status">
          {entry.status === "allowed" ? "已回答" : entry.status === "denied" ? "已略過" : STATUS_TEXT.cancelled}
        </div>
      )}
    </div>
  );
}
