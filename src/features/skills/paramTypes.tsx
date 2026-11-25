// Input types for skill parameters: which control a value is entered with,
// how it is checked, and how it is written into the prompt.

import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import type { ParamType, SkillParam } from "../../shared/api/skills";

export const PARAM_TYPES: { value: ParamType; label: string }[] = [
  { value: "text", label: "文字" },
  { value: "multiline", label: "多行文字" },
  { value: "number", label: "數字" },
  { value: "date", label: "日期" },
  { value: "datetime", label: "日期時間" },
  { value: "time", label: "時間" },
  { value: "select", label: "選項" },
  { value: "boolean", label: "是／否" },
  { value: "file", label: "檔案路徑" },
  { value: "directory", label: "資料夾路徑" },
];

export const PARAM_TYPE_VALUES = PARAM_TYPES.map((t) => t.value);

/** Stored as the default of date and time parameters to mean "when the skill runs". */
export const CURRENT = "@now";

export const YES = "是";
export const NO = "否";

/** Parameters saved before types existed are text, or multiline text if their default was. */
export function typeOf(param: SkillParam): ParamType {
  if (param.type && PARAM_TYPE_VALUES.includes(param.type)) return param.type;
  return param.defaultValue.includes("\n") ? "multiline" : "text";
}

/** A `select` parameter's choices, trimmed and without blanks. */
export function optionsOf(param: SkillParam): string[] {
  return typeOf(param) === "select" ? (param.options ?? []).map((o) => o.trim()).filter(Boolean) : [];
}

export function isTemporal(type: ParamType): boolean {
  return type === "date" || type === "datetime" || type === "time";
}

/** The value a run starts with; "now" defaults become the current date or time. */
export function initialValue(param: SkillParam): string {
  const type = typeOf(param);
  if (param.defaultValue === CURRENT && isTemporal(type)) return currentValue(type);
  if (type === "boolean") return param.defaultValue === YES ? YES : NO;
  if (type === "select") {
    const options = optionsOf(param);
    return options.includes(param.defaultValue) ? param.defaultValue : (options[0] ?? "");
  }
  return param.defaultValue;
}

function currentValue(type: ParamType): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return type === "date" ? date : type === "time" ? time : `${date}T${time}`;
}

/** How the value reads in the prompt. */
export function formatValue(param: SkillParam, value: string): string {
  return typeOf(param) === "datetime" ? value.replace("T", " ") : value;
}

/** Why the value doesn't fit the type, or null. Empty values are allowed. */
export function valueProblem(param: SkillParam, value: string): string | null {
  const name = param.label || param.name;
  if (!value.trim()) return null;
  switch (typeOf(param)) {
    case "number":
      return Number.isFinite(Number(value)) ? null : `「${name}」必須是數字`;
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : `「${name}」必須是日期（YYYY-MM-DD）`;
    case "datetime":
      return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) ? null : `「${name}」必須是日期時間`;
    case "time":
      return /^\d{2}:\d{2}/.test(value) ? null : `「${name}」必須是時間（HH:MM）`;
    case "select":
      return optionsOf(param).includes(value) ? null : `「${name}」必須是其中一個選項`;
    default:
      return null;
  }
}

/** Problems with a parameter's own settings, checked in the editor. */
export function paramProblem(param: SkillParam): string | null {
  const type = typeOf(param);
  if (type === "select" && optionsOf(param).length === 0) {
    return `「${param.label || param.name}」是選項，請至少設定一個選項`;
  }
  if (param.defaultValue === CURRENT && isTemporal(type)) return null;
  return valueProblem(param, param.defaultValue);
}

interface InputProps {
  param: SkillParam;
  value: string;
  onChange: (value: string) => void;
  /** Where the file pickers start. */
  dir?: string | null;
}

/** The control for entering a value of the parameter's type. */
export function ParamInput({ param, value, onChange, dir }: InputProps) {
  const type = typeOf(param);
  switch (type) {
    case "multiline":
      return <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return (
        <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      );
    case "date":
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return (
        <input
          type="datetime-local"
          value={value.replace(" ", "T")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "time":
      return <input type="time" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {!optionsOf(param).includes(value) && <option value={value}>{value || "（未選擇）"}</option>}
          {optionsOf(param).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <span className="skill-form__toggle">
          {[YES, NO].map((choice) => (
            <button
              key={choice}
              type="button"
              className={value === choice ? "button--primary" : undefined}
              onClick={() => onChange(choice)}
            >
              {choice}
            </button>
          ))}
        </span>
      );
    case "file":
    case "directory": {
      const pick = async () => {
        const picked = await open({
          directory: type === "directory",
          multiple: false,
          title: param.label || param.name,
          defaultPath: value || dir || undefined,
        });
        if (typeof picked === "string") onChange(picked);
      };
      return (
        <span className="skill-form__path">
          <input
            className="skill-form__mono"
            value={value}
            placeholder={type === "directory" ? "資料夾路徑" : "檔案路徑"}
            onChange={(e) => onChange(e.target.value)}
          />
          <button type="button" className="button--icon" onClick={() => void pick()}>
            <FolderOpen size={14} />
            選擇…
          </button>
        </span>
      );
    }
    default:
      return <input value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}
