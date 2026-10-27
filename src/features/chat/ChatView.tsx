import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { QueuedMessages } from "./QueuedMessages";
import type { ChatController } from "./useChat";

interface Props {
  chat: ChatController;
  /** Non-null disables input and shows why. */
  disabledReason: string | null;
  cwd: string | null;
}

export function ChatView({ chat, disabledReason, cwd }: Props) {
  return (
    <main className="chat">
      <MessageList
        key={chat.state.conversationId}
        entries={chat.state.entries}
        draft={chat.state.draft}
        busy={chat.state.busy}
        onRespond={(requestId, response) => void chat.respond(requestId, response)}
      />
      {chat.queued.length > 0 && (
        <QueuedMessages
          items={chat.queued}
          onRemove={chat.removeQueued}
          onSendNow={
            chat.queuePaused && !disabledReason ? () => void chat.send("") : undefined
          }
        />
      )}
      <Composer
        busy={chat.state.busy}
        disabledReason={disabledReason}
        cwd={cwd}
        onSend={(text) => void chat.send(text)}
        onStop={chat.stop}
      />
    </main>
  );
}
