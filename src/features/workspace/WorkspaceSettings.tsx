import type { PermissionMode } from "../../shared/types/claude";
import { MODELS, PERMISSION_MODES, type WorkspaceController } from "./useWorkspace";

/** Permission mode and model pickers; changes apply from the next message. */
export function WorkspaceSettings({ workspace }: { workspace: WorkspaceController }) {
  const { permissionMode, setPermissionMode, model, setModel } = workspace;

  return (
    <div className="workspace-settings">
      <select
        value={permissionMode}
        onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
        title="權限模式"
      >
        {PERMISSION_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select value={model} onChange={(e) => setModel(e.target.value)} title="模型">
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
