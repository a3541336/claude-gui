import { useEffect, useState } from "react";
import { loadString, saveString } from "../../shared/storage";
import type { PermissionMode } from "../../shared/types/claude";

const CWD_KEY = "claude-gui.cwd";
const MODE_KEY = "claude-gui.permissionMode";

export const PERMISSION_MODES: Array<{ value: PermissionMode; label: string }> = [
  { value: "default", label: "預設（未允許的工具會被拒絕）" },
  { value: "acceptEdits", label: "自動接受檔案修改" },
  { value: "plan", label: "規劃模式（唯讀）" },
  { value: "bypassPermissions", label: "略過所有權限確認" },
];

export function useWorkspace() {
  const [cwd, setCwd] = useState<string | null>(() => loadString(CWD_KEY));
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    () => (loadString(MODE_KEY) as PermissionMode | null) ?? "default",
  );

  useEffect(() => saveString(CWD_KEY, cwd), [cwd]);
  useEffect(() => saveString(MODE_KEY, permissionMode), [permissionMode]);

  return { cwd, setCwd, permissionMode, setPermissionMode };
}

export type WorkspaceController = ReturnType<typeof useWorkspace>;
