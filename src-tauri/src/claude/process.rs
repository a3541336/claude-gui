use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::Deserialize;
use tokio::process::Child;

use super::locator::ClaudeBinary;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnOptions {
    /// Project directory; `None` chats without one, in [`crate::state::chat_dir`].
    pub cwd: Option<PathBuf>,
    /// `default` | `acceptEdits` | `plan` | `bypassPermissions`
    pub permission_mode: Option<String>,
    pub model: Option<String>,
    /// claude session id to resume, so a restarted process keeps the conversation.
    pub resume: Option<String>,
}

/// Keeps the CLI's habit of remembering across conversations, in the
/// directory's CLAUDE.md, which every later session there reads on start.
const MEMORY_PROMPT: &str = "\
# 長期記憶（./CLAUDE.md）
目前工作目錄的 ./CLAUDE.md 是跨對話的長期記憶：之後在同一個目錄開始的每個對話都會自動讀取它。
- 對話或執行工作的過程中，得知值得長期記住的事（使用者的偏好與指示、專案慣例、建置與測試指令、踩過的坑與正確做法、重要決定）時，用編輯工具簡潔地記進 ./CLAUDE.md，檔案不存在就建立。
- 使用者說「記住」「以後都要」「下次」之類的話時一定要記。
- 只記之後仍然有用、又無法直接從檔案看出來的事；不要記這次任務的暫時進度，不要重複已有的內容；發現記錄過時或錯誤就更新或刪除。
- 依主題整理成條列，用使用者的語言撰寫。記完用一句話告訴使用者記了什麼。";

/// Starts a long-lived claude process that reads user messages from stdin and
/// writes one JSON event per line to stdout.
pub fn spawn(binary: &ClaudeBinary, cwd: &Path, opts: &SpawnOptions) -> std::io::Result<Child> {
    let mut cmd = binary.command();
    cmd.args([
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        // Adds `stream_event` lines with text deltas ahead of each complete message.
        "--include-partial-messages",
        // Permission prompts arrive on stdout as `control_request` lines and
        // are answered on stdin, instead of being denied automatically.
        "--permission-prompt-tool",
        "stdio",
        "--append-system-prompt",
        MEMORY_PROMPT,
        // Recording memories shouldn't need a permission prompt each time.
        "--allowedTools",
        "Edit(./CLAUDE.md)",
    ]);
    if let Some(mode) = &opts.permission_mode {
        cmd.args(["--permission-mode", mode]);
    }
    if let Some(model) = &opts.model {
        cmd.args(["--model", model]);
    }
    if let Some(session_id) = &opts.resume {
        cmd.args(["--resume", session_id]);
    }
    cmd.current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
}
