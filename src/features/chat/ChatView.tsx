import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import type { ChatController } from "./useChat";

interface Props {
  chat: ChatController;
  /** Non-null disables input and shows why. */
  disabledReason: string | null;
}

export function ChatView({ chat, disabledReason }: Props) {
  return (
    <main className="chat">
      <MessageList
        entries={chat.state.entries}
        busy={chat.state.busy}
        onRespond={(requestId, response) => void chat.respond(requestId, response)}
      />
      <Composer
        busy={chat.state.busy}
        disabledReason={disabledReason}
        onSend={(text) => void chat.send(text)}
        onStop={chat.stop}
      />
    </main>
  );
}
