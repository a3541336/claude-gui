import { ask } from "@tauri-apps/plugin-dialog";
import type { AccountController } from "./useAccount";

interface Props {
  account: AccountController;
  /** Called before logging out, e.g. to stop the running claude. */
  onBeforeLogout: () => void;
}

/** Signed-in account at the bottom of the sidebar. */
export function AccountBar({ account, onBeforeLogout }: Props) {
  const { state, pending } = account;

  const confirmLogout = async () => {
    const ok = await ask("登出後需要重新登入才能繼續使用 Claude。確定要登出？", {
      title: "登出",
      kind: "warning",
    });
    if (!ok) return;
    onBeforeLogout();
    await account.logout();
  };

  if (state.kind === "unknown") return null;

  if (state.kind === "loading" || pending) {
    return (
      <footer className="account">
        <span className="account__muted">
          {pending === "login"
            ? "請在瀏覽器完成登入…"
            : pending === "logout"
              ? "登出中…"
              : "讀取帳號…"}
        </span>
      </footer>
    );
  }

  if (state.kind === "error") {
    return (
      <footer className="account">
        <span className="account__error" title={state.error}>
          {state.error}
        </span>
        <button onClick={() => void account.refresh()}>重試</button>
      </footer>
    );
  }

  const { status } = state;
  if (!status.loggedIn) {
    return (
      <footer className="account">
        <span className="account__muted">尚未登入</span>
        <button className="button--primary" onClick={() => void account.login()}>
          登入
        </button>
      </footer>
    );
  }

  const name = status.email ?? status.authMethod ?? "已登入";
  const detail = [status.orgName, status.subscriptionType].filter(Boolean).join(" · ");
  return (
    <footer className="account">
      <span className="account__avatar">{name.charAt(0).toUpperCase()}</span>
      <span className="account__who" title={[name, detail].filter(Boolean).join("\n")}>
        <span className="account__name">{name}</span>
        {detail && <span className="account__detail">{detail}</span>}
      </span>
      <button onClick={() => void confirmLogout()}>登出</button>
    </footer>
  );
}
