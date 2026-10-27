import { Plus } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { projectApi } from "../../shared/api/project";
import { Modal } from "../../shared/components/Modal";

interface Props {
  /** null edits the one shared by chats without a project. */
  cwd: string | null;
  /** Called after saving, so running conversations pick up the new content. */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Edits the project's CLAUDE.md: memory claude reads at the start of every
 * session here, and adds to on its own while working.
 */
export function ClaudeMdDialog({ cwd, onSaved, onClose }: Props) {
  // null while loading.
  const [content, setContent] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectApi.readClaudeMd(cwd).then(
      (text) => {
        setExists(text !== null);
        setContent(text ?? "");
      },
      (e) => {
        setError(String(e));
        setContent("");
      },
    );
  }, [cwd]);

  const addNote = () => {
    const text = note.trim();
    if (!text || content === null) return;
    const base = content.replace(/\s+$/, "");
    setContent(`${base}${base ? "\n" : ""}- ${text}\n`);
    setNote("");
  };

  const onNoteKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const composing = e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
    if (e.key === "Enter" && !composing) {
      e.preventDefault();
      addNote();
    }
  };

  const save = async () => {
    if (content === null) return;
    setSaving(true);
    try {
      await projectApi.writeClaudeMd(cwd, content);
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <Modal title={cwd ? "專案記憶（CLAUDE.md）" : "閒聊記憶（CLAUDE.md）"} onClose={onClose}>
      <div className="modal__body skill-form">
        <p className="skill-form__hint">
          {cwd
            ? "Claude 每次在這個目錄開始對話時都會讀取這份檔案，對話中學到值得記住的事也會自己記進來。"
            : "所有閒聊共用這份記憶，Claude 每次閒聊時都會讀取，聊天中學到值得記住的事也會自己記進來。"}
          也可以在輸入框用 # 開頭快速新增一筆。
          {!exists && content !== null && " 目前還沒有這個檔案，儲存後會建立。"}
        </p>
        <div className="claude-md__add">
          <input
            placeholder="新增一筆記錄，Enter 加到檔案最後"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onNoteKeyDown}
            disabled={content === null}
          />
          <button className="button--icon" onClick={addNote} disabled={!note.trim()}>
            <Plus size={14} />
            加入
          </button>
        </div>
        <label>
          <span className="skill-form__mono" title={cwd ?? undefined}>
            {cwd ? `${cwd.replace(/[\\/]+$/, "")}/CLAUDE.md` : "閒聊共用的 CLAUDE.md"}
          </span>
          <textarea
            className="skill-form__mono"
            rows={18}
            value={content ?? ""}
            placeholder={content === null ? "讀取中…" : "# 專案說明"}
            onChange={(e) => setContent(e.target.value)}
            disabled={content === null}
          />
        </label>
      </div>
      <div className="modal__footer">
        {error && <span className="skill-form__error">{error}</span>}
        <button onClick={onClose}>取消</button>
        <button
          className="button--primary"
          disabled={content === null || saving}
          onClick={() => void save()}
        >
          儲存
        </button>
      </div>
    </Modal>
  );
}
