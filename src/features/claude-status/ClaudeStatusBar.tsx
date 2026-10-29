import { open } from "@tauri-apps/plugin-dialog";
import type { ClaudeStatusController } from "./useClaudeStatus";

const INSTALL_HINT = navigator.userAgent.includes("Windows")
  ? "irm https://claude.ai/install.ps1 | iex"
  : "curl -fsSL https://claude.ai/install.sh | bash";

export function ClaudeStatusBar({ claude }: { claude: ClaudeStatusController }) {
  const { status, check, install } = claude;

  const pickPath = async () => {
    const path = await open({ multiple: false, directory: false, title: "選擇 claude 執行檔" });
    if (typeof path === "string") await check(path);
  };

  if (status.kind === "checking") {
    return <div className="status-bar">正在偵測 claude CLI…</div>;
  }

  if (status.kind === "installing") {
    return <div className="status-bar">正在安裝 claude CLI，可能需要幾分鐘…</div>;
  }

  if (status.kind === "ready") {
    return (
      <div className="status-bar" title={status.info.path}>
        claude {status.info.version}
      </div>
    );
  }

  return (
    <div className="status-bar status-bar--error">
      <div>
        <strong>{status.error}</strong>
        <p>
          可以一鍵安裝，或在終端機手動執行：<code>{INSTALL_HINT}</code>
        </p>
      </div>
      <div className="status-bar__actions">
        <button className="button--primary" onClick={() => void install()}>
          一鍵安裝
        </button>
        <button onClick={() => void check(null)}>重新偵測</button>
        <button onClick={() => void pickPath()}>手動指定路徑</button>
      </div>
    </div>
  );
}
