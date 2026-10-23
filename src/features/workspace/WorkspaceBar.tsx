import { open } from "@tauri-apps/plugin-dialog";
import type { WorkspaceController } from "./useWorkspace";

interface Props {
  workspace: WorkspaceController;
  onChangeCwd: (cwd: string) => void;
  onNewChat: () => void;
  /** Absent while there is no finished conversation to turn into a skill. */
  onMakeSkill?: () => void;
}

export function WorkspaceBar({ workspace, onChangeCwd, onNewChat, onMakeSkill }: Props) {
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
      <button
        onClick={onMakeSkill}
        disabled={!onMakeSkill}
        title="讓 AI 把這段對話整理成可重複使用的技能"
      >
        轉成技能
      </button>
      <button onClick={onNewChat}>新對話</button>
    </header>
  );
}
