# Claude GUI

Claude Code 的桌面圖形介面，以 Tauri 2（Rust）+ React 製作，支援 macOS 與 Windows。

GUI 本身不含 Claude 帳號或 API key，而是呼叫使用者電腦上的 `claude` CLI，
以 `--input-format stream-json --output-format stream-json` 雙向串流溝通。

## 使用者需求

1. 安裝 Claude Code 並完成登入
   - macOS：`curl -fsSL https://claude.ai/install.sh | bash`
   - Windows（PowerShell）：`irm https://claude.ai/install.ps1 | iex`
   - 安裝後在終端機執行一次 `claude` 完成登入
2. 開啟 Claude GUI，選擇工作目錄後即可開始對話。若偵測不到 claude，可在畫面上手動指定路徑。

## 開發

需求：Node.js 20.19+、Rust（rustup）。Windows 另需 WebView2（Win10/11 已內建）與 MSVC build tools。

```bash
npm install
npm run tauri dev     # 開發模式（前端熱更新）
npm run tauri build   # 打包成安裝檔，輸出在 src-tauri/target/release/bundle/
```

## 發佈

推送 `v*` tag 後，GitHub Actions（`.github/workflows/release.yml`）會建置
macOS（universal）與 Windows 安裝檔，放到草稿 release。

```bash
git tag v0.1.0 && git push origin v0.1.0
```

未簽章的版本：macOS 首次開啟需按右鍵 →「打開」，或執行 `xattr -cr "/Applications/Claude GUI.app"`；
Windows 會出現 SmartScreen 警告，選「其他資訊 → 仍要執行」。

## 專案結構

```
src-tauri/src/
├── lib.rs              # Tauri 進入點，註冊 plugin、state、commands
├── error.rs            # AppError（序列化成字串回傳前端）
├── events.rs           # 後端 → 前端的事件名稱與 payload
├── state.rs            # AppState：claude 路徑快取、SessionManager
├── claude/             # 與 Claude Code CLI 整合
│   ├── locator.rs      #   尋找 claude 執行檔（PATH、login shell、常見安裝位置）
│   ├── process.rs      #   組參數並啟動子程序
│   ├── protocol.rs     #   寫入 stdin 的訊息格式
│   └── session.rs      #   管理多個程序，轉送 stdout/stderr 為事件
└── commands/           # 前端可呼叫的 Tauri commands（薄層）
    ├── system.rs       #   detect_claude、set_claude_path
    └── session.rs      #   start_session、send_message、stop_session

src/
├── App.tsx
├── shared/             # 跨功能共用
│   ├── api/claude.ts   #   對 Rust 後端的型別化包裝（invoke / listen）
│   ├── types/claude.ts #   stream-json 訊息型別
│   ├── components/     #   Markdown 等共用元件
│   └── storage.ts
└── features/           # 依功能切分，各自包含 hook 與元件
    ├── chat/           #   對話：chatReducer、useChat、MessageList、Composer、blocks/
    ├── claude-status/  #   claude CLI 偵測狀態
    └── workspace/      #   工作目錄與權限模式
```

新增功能時：後端邏輯放 `claude/`，在 `commands/` 開出薄的 command，
於 `lib.rs` 註冊，再到 `shared/api/claude.ts` 加上對應的型別化呼叫。
