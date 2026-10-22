import { open } from "@tauri-apps/plugin-dialog";
import type { WorkspaceController } from "./useWorkspace";

interface Props {
  workspace: WorkspaceController;
  onChangeCwd: (cwd: string) => void;
  onNewChat: () => void;
}

export function WorkspaceBar({ workspace, onChangeCwd, onNewChat }: Props) {
  const { cwd } = workspace;

  const pickDirectory = async () => {
    const dir = await open({ directory: true, multiple: false, title: "選擇工作目錄" });
    if (typeof dir === "string") onChangeCwd(dir);
  };

  return (
    <header className="workspace-bar">
      <button className="workspace-bar__cwd" onClick={() => void pickDirectory()} title={cwd ?? ""}>
        {cwd ?? "選擇工作目錄…"}
      </button>
      <button onClick={onNewChat}>新對話</button>
    </header>
  );
}
