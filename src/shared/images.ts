// Images attached to a message: pasted, dropped onto the window, or picked.
// They are sent to claude as base64 image blocks, so they are shrunk to what the
// API accepts first.

import { invoke } from "@tauri-apps/api/core";

export interface ImageAttachment {
  /** One of {@link SENDABLE_TYPES}. */
  mediaType: string;
  /** Base64, without a `data:` prefix. */
  data: string;
  /** Shown as a tooltip. */
  name?: string;
}

const SENDABLE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
/** Longer sides are scaled down; the model sees no more detail than this anyway. */
const MAX_SIDE = 2000;
/** The API refuses images over 5 MB; base64 adds a third. */
const MAX_BASE64_LENGTH = 5 * 1024 * 1024;

const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
};

/** The image type of a file path by its extension, or null for other files. */
export function imageTypeOfPath(path: string): string | null {
  const ext = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase();
  return ext ? (EXTENSION_TYPES[ext] ?? null) : null;
}

export function dataUrl(image: ImageAttachment): string {
  return `data:${image.mediaType};base64,${image.data}`;
}

/** Reads an image file dropped onto the window. */
export async function imageFromPath(path: string): Promise<ImageAttachment> {
  const bytes = await invoke<ArrayBuffer>("read_image_file", { path });
  const type = imageTypeOfPath(path) ?? "application/octet-stream";
  const name = path.split(/[\\/]/).pop();
  return imageFromBlob(new Blob([bytes], { type }), name);
}

/**
 * Keeps the image as it is when the API takes it, otherwise re-encodes it:
 * scaled down when too large, as PNG for other formats (HEIC, BMP, …), or as
 * JPEG when PNG is still too big.
 */
export async function imageFromBlob(blob: Blob, name?: string): Promise<ImageAttachment> {
  const bitmap = await createImageBitmap(blob).catch(() => {
    throw new Error(`無法讀取圖片${name ? `「${name}」` : ""}`);
  });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && SENDABLE_TYPES.includes(blob.type)) {
      const data = await toBase64(blob);
      if (data.length <= MAX_BASE64_LENGTH) return { mediaType: blob.type, data, name };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const [type, quality] of [
      ["image/png", undefined],
      ["image/jpeg", 0.9],
      ["image/jpeg", 0.75],
      ["image/jpeg", 0.5],
    ] as const) {
      const encoded = await canvasBlob(canvas, type, quality);
      const data = await toBase64(encoded);
      if (data.length <= MAX_BASE64_LENGTH) return { mediaType: type, data, name };
    }
    throw new Error(`圖片${name ? `「${name}」` : ""}太大，無法附加`);
  } finally {
    bitmap.close();
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圖片轉換失敗"))), type, quality),
  );
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("讀取圖片失敗"));
    reader.readAsDataURL(blob);
  });
}
