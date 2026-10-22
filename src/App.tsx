import { ChatView } from "./features/chat/ChatView";
import { useChat } from "./features/chat/useChat";
import { ClaudeStatusBar } from "./features/claude-status/ClaudeStatusBar";
import { useClaudeStatus } from "./features/claude-status/useClaudeStatus";
import { HistorySidebar } from "./features/history/HistorySidebar";
import { useHistory } from "./features/history/useHistory";
import { UsageBar } from "./features/usage/UsageBar";
import { WorkspaceBar } from "./features/workspace/WorkspaceBar";
import { useWorkspace } from "./features/workspace/useWorkspace";

export default function App() {
  const claude = useClaudeStatus();
  const workspace = useWorkspace();
  const chat = useChat({
    cwd: workspace.cwd,
    permissionMode: workspace.permissionMode,
    model: workspace.model,
  });
  const history = useHistory(chat.state, workspace.cwd);

  const disabledReason =
    claude.status.kind !== "ready"
      ? "claude CLI 尚未就緒"
      : !workspace.cwd
        ? "請先選擇工作目錄"
        : null;

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

  const deleteConversation = (id: string) => {
    // Otherwise the next change to the open conversation would save it again.
    if (id === chat.state.conversationId) chat.newChat();
    history.remove(id);
  };

  return (
    <div className="app">
      <HistorySidebar
        items={history.items}
        error={history.error}
        activeId={chat.state.conversationId}
        cwd={workspace.cwd}
        onOpen={(id) => void openConversation(id)}
        onDelete={deleteConversation}
        onNewChatIn={newChatIn}
      />
      <div className="app__main">
        <WorkspaceBar
          workspace={workspace}
          activeModel={chat.state.model}
          onChangeCwd={changeCwd}
          onNewChat={chat.newChat}
        />
        <ClaudeStatusBar claude={claude} />
        <ChatView chat={chat} disabledReason={disabledReason} />
        <UsageBar
          contextTokens={chat.state.contextTokens}
          contextWindow={chat.state.contextWindow}
          rateLimits={chat.state.rateLimits}
        />
      </div>
    </div>
  );
}
