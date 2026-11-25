import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowUp, ImagePlus, ListPlus, Paperclip, Square, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import {
  dataUrl,
  imageFromBlob,
  imageFromPath,
  imageTypeOfPath,
  type ImageAttachment,
} from "../../shared/images";

interface Props {
  /** While claude is busy, sent messages wait in a queue. */
  busy: boolean;
  disabledReason: string | null;
  /** Picked files inside it are referenced by relative path. */
  cwd: string | null;
  onSend: (text: string, images: ImageAttachment[]) => void;
  onStop: () => void;
}

export function Composer({ busy, disabledReason, cwd, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  /** Images still being read; sending waits for them. */
  const [loading, setLoading] = useState(0);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled = disabledReason !== null;
  const empty = !text.trim() && files.length === 0 && images.length === 0;

  const submit = () => {
    if (disabled || empty || loading > 0) return;
    // claude expands @-mentions itself and attaches the file contents.
    const mentions = files.map((path) => `@"${displayPath(path, cwd)}"`).join(" ");
    onSend([mentions, text.trim() && text].filter(Boolean).join("\n"), images);
    setText("");
    setFiles([]);
    setImages([]);
    setAttachError(null);
  };

  const addImages = async (sources: Array<() => Promise<ImageAttachment>>) => {
    if (sources.length === 0) return;
    setAttachError(null);
    setLoading((n) => n + sources.length);
    const results = await Promise.allSettled(sources.map((read) => read()));
    setLoading((n) => n - sources.length);
    const added = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = results.flatMap((r) => (r.status === "rejected" ? [String(r.reason)] : []));
    if (added.length > 0) setImages((prev) => [...prev, ...added]);
    if (failed.length > 0) setAttachError(failed.join("；").replace(/Error: /g, ""));
  };

  /** Images become image attachments, other files @-mentions. */
  const addPaths = (paths: string[]) => {
    const imagePaths = paths.filter((p) => imageTypeOfPath(p));
    const others = paths.filter((p) => !imageTypeOfPath(p));
    if (others.length > 0) setFiles((prev) => [...prev, ...others.filter((p) => !prev.includes(p))]);
    void addImages(imagePaths.map((p) => () => imageFromPath(p)));
  };

  // Files dragged onto the window. Tauri delivers them with their paths instead of as DOM drops.
  const addPathsRef = useRef(addPaths);
  useLayoutEffect(() => {
    addPathsRef.current = addPaths;
  });
  useEffect(() => {
    if (disabled) return;
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "enter") setDragging(true);
      else if (payload.type === "leave") setDragging(false);
      else if (payload.type === "drop") {
        setDragging(false);
        addPathsRef.current(payload.paths);
        textareaRef.current?.focus();
      }
    });
    return () => {
      setDragging(false);
      void unlisten.then((fn) => fn());
    };
  }, [disabled]);

  const pickFiles = async () => {
    const picked = await open({
      multiple: true,
      directory: false,
      title: "指定檔案",
      defaultPath: cwd ?? undefined,
    });
    if (picked) addPaths(picked);
  };

  const pickImages = async () => {
    const picked = await open({
      multiple: true,
      directory: false,
      title: "附加圖片",
      filters: [{ name: "圖片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "heic", "bmp"] }],
    });
    if (picked) addPaths(picked);
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (pasted.length === 0) return;
    // Otherwise a copied image file also pastes its name as text.
    e.preventDefault();
    void addImages(pasted.map((file) => () => imageFromBlob(file, file.name || undefined)));
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
      {dragging && <div className="drop-overlay">放開以附加到訊息（圖片會直接傳給 Claude）</div>}
      <div className="composer__input">
        {(images.length > 0 || loading > 0) && (
          <ul className="composer__images">
            {images.map((image, i) => (
              <li key={i} className="composer__image" title={image.name}>
                <img src={dataUrl(image)} alt={image.name ?? "圖片"} />
                <button
                  className="button--icon"
                  title="移除"
                  aria-label="移除圖片"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
            {loading > 0 && <li className="composer__image composer__image--loading">讀取中…</li>}
          </ul>
        )}
        {attachError && <p className="composer__error">{attachError}</p>}
        {files.length > 0 && (
          <ul className="composer__files">
            {files.map((path) => (
              <li key={path} className="composer__file" title={path}>
                {displayPath(path, cwd)}
                <button
                  className="button--icon"
                  title="移除"
                  aria-label="移除"
                  onClick={() => setFiles((prev) => prev.filter((p) => p !== path))}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          disabled={disabled}
          rows={1}
        />
      </div>
      <button
        className="composer__attach button--icon"
        onClick={() => void pickFiles()}
        disabled={disabled}
        title="指定檔案，內容會附給 Claude"
        aria-label="指定檔案"
      >
        <Paperclip size={16} />
      </button>
      <button
        className="composer__attach button--icon"
        onClick={() => void pickImages()}
        disabled={disabled}
        title="附加圖片（也可以直接貼上或拖進視窗）"
        aria-label="附加圖片"
      >
        <ImagePlus size={16} />
      </button>
      {busy && (
        <button className="composer__stop button--icon" title="停止" aria-label="停止" onClick={onStop}>
          <Square size={16} fill="currentColor" />
        </button>
      )}
      <button
        className="button--icon"
        title={busy ? "排入佇列，這輪結束後送出" : "送出"}
        aria-label={busy ? "排入佇列" : "送出"}
        onClick={submit}
        disabled={disabled || empty || loading > 0}
      >
        {busy ? <ListPlus size={16} /> : <ArrowUp size={16} />}
      </button>
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
