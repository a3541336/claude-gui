import { useState, type KeyboardEvent } from "react";

interface Props {
  busy: boolean;
  disabledReason: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ busy, disabledReason, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const disabled = disabledReason !== null;

  const submit = () => {
    if (disabled || busy || !text.trim()) return;
    onSend(text);
    setText("");
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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabledReason ?? "輸入訊息，Enter 送出，Shift+Enter 換行"}
        disabled={disabled}
        rows={3}
      />
      {busy ? (
        <button className="composer__stop" onClick={onStop}>
          停止
        </button>
      ) : (
        <button onClick={submit} disabled={disabled || !text.trim()}>
          送出
        </button>
      )}
    </div>
  );
}
