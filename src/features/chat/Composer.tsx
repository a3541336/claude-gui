import { open } from "@tauri-apps/plugin-dialog";
import { useState, type KeyboardEvent } from "react";

interface Props {
  busy: boolean;
  disabledReason: string | null;
  /** Picked files inside it are referenced by relative path. */
  cwd: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ busy, disabledReason, cwd, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const disabled = disabledReason !== null;
  const empty = !text.trim() && files.length === 0;

  const submit = () => {
    if (disabled || busy || empty) return;
    // claude expands @-mentions itself and attaches the file contents.
    const mentions = files.map((path) => `@"${displayPath(path, cwd)}"`).join(" ");
    onSend([mentions, text.trim() && text].filter(Boolean).join("\n"));
    setText("");
    setFiles([]);
  };

  const pickFiles = async () => {
    const picked = await open({
      multiple: true,
      directory: false,
      title: "指定檔案",
      defaultPath: cwd ?? undefined,
    });
    if (picked) setFiles((prev) => [...prev, ...picked.filter((p) => !prev.includes(p))]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't send while an IME (e.g. 注音) is still composing. WebKit (the macOS
    // webview) fires compositionend before the keydown of the Enter that confirms
    // the candidate, so isComposing is already false there; keyCode 229 still marks it.
    const composing = e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
    if (e.key === "Enter" && !e.shiftKey && !composing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer">
      <div className="composer__input">
        {files.length > 0 && (
          <ul className="composer__files">
            {files.map((path) => (
              <li key={path} className="composer__file" title={path}>
                {displayPath(path, cwd)}
                <button
                  title="移除"
                  onClick={() => setFiles((prev) => prev.filter((p) => p !== path))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabledReason ?? "輸入訊息，Enter 送出，Shift+Enter 換行"}
          disabled={disabled}
          rows={3}
        />
      </div>
      <button
        className="composer__attach"
        onClick={() => void pickFiles()}
        disabled={disabled}
        title="指定檔案，內容會附給 Claude"
      >
        指定檔案
      </button>
      {busy ? (
        <button className="composer__stop" onClick={onStop}>
          停止
        </button>
      ) : (
        <button onClick={submit} disabled={disabled || empty}>
          送出
        </button>
      )}
    </div>
  );
}

/** Relative to `cwd` when the file is inside it, like the CLI's @-mentions. */
function displayPath(path: string, cwd: string | null): string {
  if (!cwd) return path;
  const base = cwd.replace(/[\\/]+$/, "");
  const inside = path.startsWith(base) && /^[\\/]/.test(path.slice(base.length));
  return inside ? path.slice(base.length + 1) : path;
}
