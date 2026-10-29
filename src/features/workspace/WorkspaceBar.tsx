import { open } from "@tauri-apps/plugin-dialog";
import { NotebookPen, PanelLeftClose, PanelLeftOpen, SquarePen, WandSparkles, X } from "lucide-react";
import type { WorkspaceController } from "./useWorkspace";

interface Props {
  workspace: WorkspaceController;
  /** null switches to chatting without a project. */
  onChangeCwd: (cwd: string | null) => void;
  onEditClaudeMd: () => void;
  onNewChat: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  /** Absent while there is no finished conversation to turn into a skill. */
  onMakeSkill?: () => void;
}

export function WorkspaceBar({
  workspace,
  onChangeCwd,
  onEditClaudeMd,
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
      <button
        className={`workspace-bar__cwd${cwd ? "" : " workspace-bar__cwd--chat"}`}
        onClick={() => void pickDirectory()}
        title={cwd ?? "閒聊中，不會讀寫任何專案。點此選擇工作目錄開始工作任務"}
      >
        {cwd ?? "閒聊（點此選擇工作目錄）"}
      </button>
      {cwd && (
        <button
          className="button--icon"
          title="改為閒聊（不指定工作目錄）"
          aria-label="改為閒聊"
          onClick={() => onChangeCwd(null)}
        >
          <X size={16} />
        </button>
      )}
      <button
        className="button--icon"
        title={cwd ? "專案記憶（CLAUDE.md）" : "閒聊記憶（CLAUDE.md）"}
        aria-label="記憶"
        onClick={onEditClaudeMd}
      >
        <NotebookPen size={16} />
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
