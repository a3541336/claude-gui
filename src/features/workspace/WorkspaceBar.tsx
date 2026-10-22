import { open } from "@tauri-apps/plugin-dialog";
import type { PermissionMode } from "../../shared/types/claude";
import { PERMISSION_MODES, type WorkspaceController } from "./useWorkspace";

interface Props {
  workspace: WorkspaceController;
  model: string | null;
  onNewChat: () => void;
}

export function WorkspaceBar({ workspace, model, onNewChat }: Props) {
  const { cwd, setCwd, permissionMode, setPermissionMode } = workspace;

  const pickDirectory = async () => {
    const dir = await open({ directory: true, multiple: false, title: "選擇工作目錄" });
    if (typeof dir === "string") setCwd(dir);
  };

  return (
    <header className="workspace-bar">
      <button className="workspace-bar__cwd" onClick={() => void pickDirectory()} title={cwd ?? ""}>
        {cwd ?? "選擇工作目錄…"}
      </button>
      <select
        value={permissionMode}
        onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
      >
        {PERMISSION_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      {model && <span className="workspace-bar__model">{model}</span>}
      <button onClick={onNewChat}>新對話</button>
    </header>
  );
}
