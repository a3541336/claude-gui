import { ChatView } from "./features/chat/ChatView";
import { useChat } from "./features/chat/useChat";
import { ClaudeStatusBar } from "./features/claude-status/ClaudeStatusBar";
import { useClaudeStatus } from "./features/claude-status/useClaudeStatus";
import { WorkspaceBar } from "./features/workspace/WorkspaceBar";
import { useWorkspace } from "./features/workspace/useWorkspace";

export default function App() {
  const claude = useClaudeStatus();
  const workspace = useWorkspace();
  const chat = useChat({ cwd: workspace.cwd, permissionMode: workspace.permissionMode });

  const disabledReason =
    claude.status.kind !== "ready"
      ? "claude CLI 尚未就緒"
      : !workspace.cwd
        ? "請先選擇工作目錄"
        : null;

  return (
    <div className="app">
      <WorkspaceBar workspace={workspace} model={chat.state.model} onNewChat={chat.newChat} />
      <ClaudeStatusBar claude={claude} />
      <ChatView chat={chat} disabledReason={disabledReason} />
    </div>
  );
}
