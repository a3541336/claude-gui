import { useRef, useState } from "react";
import { AccountBar } from "./features/account/AccountBar";
import { useAccount } from "./features/account/useAccount";
import { ChatView } from "./features/chat/ChatView";
import { useChat } from "./features/chat/useChat";
import { ClaudeStatusBar } from "./features/claude-status/ClaudeStatusBar";
import { useClaudeStatus } from "./features/claude-status/useClaudeStatus";
import { HistorySidebar } from "./features/history/HistorySidebar";
import { useHistory } from "./features/history/useHistory";
import { draftSkill } from "./features/skills/draftSkill";
import { SkillDrafting, SkillEditor, SkillRunner } from "./features/skills/SkillDialogs";
import { SkillsPanel } from "./features/skills/SkillsPanel";
import { useSkills, type Skill } from "./features/skills/useSkills";
import { UpdateBanner } from "./features/updates/UpdateBanner";
import { useUpdates } from "./features/updates/useUpdates";
import { UsageBar } from "./features/usage/UsageBar";
import { WorkspaceBar } from "./features/workspace/WorkspaceBar";
import { WorkspaceSettings } from "./features/workspace/WorkspaceSettings";
import { useWorkspace } from "./features/workspace/useWorkspace";

type SkillDialog =
  | { kind: "drafting"; error: string | null }
  | { kind: "edit"; skill: Skill; isNew: boolean }
  | { kind: "run"; skill: Skill };

export default function App() {
  const claude = useClaudeStatus();
  const workspace = useWorkspace();
  const chat = useChat({
    cwd: workspace.cwd,
    permissionMode: workspace.permissionMode,
    model: workspace.model,
  });
  const history = useHistory(chat.state, workspace.cwd);
  const skills = useSkills();
  const [skillDialog, setSkillDialog] = useState<SkillDialog | null>(null);
  // Identifies the latest draft request, so a cancelled one is ignored when it finishes.
  const draftRef = useRef(0);

  const account = useAccount(claude.status.kind === "ready");
  const updates = useUpdates(
    claude.status.kind === "ready" ? claude.status.info.version : null,
    claude.check,
  );
  const claudeUnavailable =
    claude.status.kind !== "ready"
      ? "claude CLI 尚未就緒"
      : account.loggedOut
        ? "尚未登入 Claude"
        : null;
  const disabledReason = claudeUnavailable ?? (!workspace.cwd ? "請先選擇工作目錄" : null);

  // A different directory is a different project, so start over.
  const changeCwd = (dir: string) => {
    if (dir === workspace.cwd) return;
    workspace.setCwd(dir);
    chat.newChat();
  };

  const newChatIn = (dir: string) => {
    workspace.setCwd(dir);
    chat.newChat();
  };

  const openConversation = async (id: string) => {
    if (id === chat.state.conversationId) return;
    const saved = await history.load(id);
    if (!saved) return;
    // claude keeps sessions per directory, so resuming needs the original cwd.
    workspace.setCwd(saved.cwd);
    chat.load(saved.snapshot);
  };

  // claude resumes sessions per directory, so drafting needs the conversation's cwd.
  const { claudeSessionId, busy } = chat.state;
  const skillSource =
    !claudeUnavailable && !busy && claudeSessionId && workspace.cwd
      ? { cwd: workspace.cwd, sessionId: claudeSessionId }
      : null;

  const makeSkill = async (cwd: string, sessionId: string) => {
    const request = ++draftRef.current;
    setSkillDialog({ kind: "drafting", error: null });
    try {
      const draft = await draftSkill(cwd, sessionId, workspace.model);
      if (request !== draftRef.current) return;
      const skill: Skill = { ...draft, id: crypto.randomUUID(), sourceCwd: cwd, updatedAt: Date.now() };
      setSkillDialog({ kind: "edit", skill, isNew: true });
    } catch (e) {
      if (request === draftRef.current) setSkillDialog({ kind: "drafting", error: String(e) });
    }
  };

  const closeSkillDialog = () => {
    draftRef.current++;
    setSkillDialog(null);
  };

  const runSkill = (prompt: string, cwd: string) => {
    setSkillDialog(null);
    workspace.setCwd(cwd);
    void chat.startWith(prompt, cwd);
  };

  const deleteConversation = (id: string) => {
    // Otherwise the next change to the open conversation would save it again.
    if (id === chat.state.conversationId) chat.newChat();
    history.remove(id);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__scroll">
          <SkillsPanel
            items={skills.items}
            error={skills.error}
            onRun={(skill) => setSkillDialog({ kind: "run", skill })}
            onEdit={(skill) => setSkillDialog({ kind: "edit", skill, isNew: false })}
            onDelete={(id) => void skills.remove(id)}
          />
          <HistorySidebar
            items={history.items}
            error={history.error}
            activeId={chat.state.conversationId}
            cwd={workspace.cwd}
            onOpen={(id) => void openConversation(id)}
            onDelete={deleteConversation}
            onNewChatIn={newChatIn}
          />
        </div>
        <AccountBar account={account} onBeforeLogout={chat.stop} />
      </aside>
      <div className="app__main">
        <WorkspaceBar
          workspace={workspace}
          onChangeCwd={changeCwd}
          onNewChat={chat.newChat}
          onMakeSkill={
            skillSource ? () => void makeSkill(skillSource.cwd, skillSource.sessionId) : undefined
          }
        />
        <UpdateBanner updates={updates} chatBusy={chat.state.busy} />
        <ClaudeStatusBar claude={claude} />
        <ChatView chat={chat} disabledReason={disabledReason} cwd={workspace.cwd} />
        <UsageBar
          model={chat.state.model}
          contextTokens={chat.state.contextTokens}
          contextWindow={chat.state.contextWindow}
          rateLimits={chat.state.rateLimits}
        />
        <WorkspaceSettings workspace={workspace} />
      </div>
      {skillDialog?.kind === "drafting" && (
        <SkillDrafting error={skillDialog.error} onClose={closeSkillDialog} />
      )}
      {skillDialog?.kind === "edit" && (
        <SkillEditor
          skill={skillDialog.skill}
          isNew={skillDialog.isNew}
          onSave={async (skill) => {
            if (await skills.save(skill)) setSkillDialog(null);
          }}
          onClose={closeSkillDialog}
        />
      )}
      {skillDialog?.kind === "run" && (
        <SkillRunner
          skill={skillDialog.skill}
          cwd={workspace.cwd}
          unavailableReason={claudeUnavailable}
          onRun={runSkill}
          onClose={closeSkillDialog}
        />
      )}
    </div>
  );
}
