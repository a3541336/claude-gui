import { open } from "@tauri-apps/plugin-dialog";
import { PanelLeftClose, PanelLeftOpen, SquarePen, WandSparkles } from "lucide-react";
import type { WorkspaceController } from "./useWorkspace";

interface Props {
  workspace: WorkspaceController;
  onChangeCwd: (cwd: string) => void;
  onNewChat: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  /** Absent while there is no finished conversation to turn into a skill. */
  onMakeSkill?: () => void;
}

export function WorkspaceBar({
  workspace,
  onChangeCwd,
  onNewChat,
  sidebarCollapsed,
  onToggleSidebar,
  onMakeSkill,
}: Props) {
  const { cwd } = workspace;

  const pickDirectory = async () => {
    const dir = await open({ directory: true, multiple: false, title: "選擇工作目錄" });
    if (typeof dir === "string") onChangeCwd(dir);
  };

  return (
    <header className="workspace-bar">
      <button
        className="button--icon"
        title={sidebarCollapsed ? "展開側邊欄" : "收合側邊欄"}
        aria-label={sidebarCollapsed ? "展開側邊欄" : "收合側邊欄"}
        aria-expanded={!sidebarCollapsed}
        onClick={onToggleSidebar}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
      <button className="workspace-bar__cwd" onClick={() => void pickDirectory()} title={cwd ?? ""}>
        {cwd ?? "選擇工作目錄…"}
      </button>
      <button
        className="button--icon"
        onClick={onMakeSkill}
        disabled={!onMakeSkill}
        title="轉成技能：讓 AI 把這段對話整理成可重複使用的技能"
        aria-label="轉成技能"
      >
        <WandSparkles size={16} />
      </button>
      <button className="button--icon" title="新對話" aria-label="新對話" onClick={onNewChat}>
        <SquarePen size={16} />
      </button>
    </header>
  );
}
