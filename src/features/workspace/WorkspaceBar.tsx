import { open } from "@tauri-apps/plugin-dialog";
import type { PermissionMode } from "../../shared/types/claude";
import { MODELS, PERMISSION_MODES, type WorkspaceController } from "./useWorkspace";

interface Props {
  workspace: WorkspaceController;
  /** Model reported by the running claude process. */
  activeModel: string | null;
  onChangeCwd: (cwd: string) => void;
  onNewChat: () => void;
}

export function WorkspaceBar({ workspace, activeModel, onChangeCwd, onNewChat }: Props) {
  const { cwd, permissionMode, setPermissionMode, model, setModel } = workspace;

  const pickDirectory = async () => {
    const dir = await open({ directory: true, multiple: false, title: "選擇工作目錄" });
    if (typeof dir === "string") onChangeCwd(dir);
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
      <select value={model} onChange={(e) => setModel(e.target.value)}>
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      {activeModel && <span className="workspace-bar__model">{activeModel}</span>}
      <button onClick={onNewChat}>新對話</button>
    </header>
  );
}
