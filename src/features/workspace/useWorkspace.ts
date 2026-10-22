import { useEffect, useState } from "react";
import { loadString, saveString } from "../../shared/storage";
import type { PermissionMode } from "../../shared/types/claude";

const CWD_KEY = "claude-gui.cwd";
const MODE_KEY = "claude-gui.permissionMode";
const MODEL_KEY = "claude-gui.model";

export const PERMISSION_MODES: Array<{ value: PermissionMode; label: string }> = [
  { value: "default", label: "預設（未允許的工具會被拒絕）" },
  { value: "acceptEdits", label: "自動接受檔案修改" },
  { value: "plan", label: "規劃模式（唯讀）" },
  { value: "bypassPermissions", label: "略過所有權限確認" },
];

/** Aliases always point at claude's latest model of each tier. "" leaves the choice to claude. */
export const MODELS: Array<{ value: string; label: string }> = [
  { value: "", label: "預設模型" },
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
];

export function useWorkspace() {
  const [cwd, setCwd] = useState<string | null>(() => loadString(CWD_KEY));
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    () => (loadString(MODE_KEY) as PermissionMode | null) ?? "default",
  );

  const [model, setModel] = useState<string>(() => loadString(MODEL_KEY) ?? "");

  useEffect(() => saveString(CWD_KEY, cwd), [cwd]);
  useEffect(() => saveString(MODE_KEY, permissionMode), [permissionMode]);
  useEffect(() => saveString(MODEL_KEY, model || null), [model]);

  return { cwd, setCwd, permissionMode, setPermissionMode, model, setModel };
}

export type WorkspaceController = ReturnType<typeof useWorkspace>;
