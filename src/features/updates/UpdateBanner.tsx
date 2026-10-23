import { ask } from "@tauri-apps/plugin-dialog";
import type { UpdatesController, UpdateState } from "./useUpdates";

interface Props {
  updates: UpdatesController;
  /** A restart stops the running conversation, so confirm first. */
  chatBusy: boolean;
}

export function UpdateBanner({ updates, chatBusy }: Props) {
  const installApp = async () => {
    if (
      chatBusy &&
      !(await ask("更新後會重新啟動，正在執行的對話會中斷（之後可從歷史紀錄接續）。要繼續嗎？", {
        title: "更新 Claude GUI",
        kind: "warning",
      }))
    ) {
      return;
    }
    void updates.installApp();
  };

  return (
    <>
      {updates.app && (
        <Row
          name="Claude GUI"
          state={updates.app}
          action="更新並重新啟動"
          onInstall={() => void installApp()}
          onDismiss={updates.dismissApp}
        />
      )}
      {updates.cli && (
        <Row
          name="Claude CLI"
          state={updates.cli}
          action="更新"
          onInstall={() => void updates.installCli()}
          onDismiss={updates.dismissCli}
        />
      )}
    </>
  );
}

interface RowProps {
  name: string;
  state: UpdateState;
  action: string;
  onInstall: () => void;
  onDismiss: () => void;
}

function Row({ name, state, action, onInstall, onDismiss }: RowProps) {
  const installing = state.kind === "installing";
  const text =
    state.kind === "installing"
      ? `正在更新 ${name} ${state.version}…${
          state.progress !== undefined ? ` ${Math.round(state.progress * 100)}%` : ""
        }`
      : state.kind === "failed"
        ? `${name} 更新失敗：${state.error}`
        : `${name} 有新版本 ${state.version}`;

  return (
    <div className={`update-banner${state.kind === "failed" ? " update-banner--error" : ""}`}>
      <span className="update-banner__text" title={text}>
        {text}
      </span>
      {!installing && (
        <>
          <button className="button--primary" onClick={onInstall}>
            {state.kind === "failed" ? "重試" : action}
          </button>
          <button className="update-banner__dismiss" title="稍後再說" onClick={onDismiss}>
            ×
          </button>
        </>
      )}
    </div>
  );
}
