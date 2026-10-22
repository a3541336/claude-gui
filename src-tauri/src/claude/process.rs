use std::path::PathBuf;
use std::process::Stdio;

use serde::Deserialize;
use tokio::process::Child;

use super::locator::ClaudeBinary;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnOptions {
    pub cwd: PathBuf,
    /// `default` | `acceptEdits` | `plan` | `bypassPermissions`
    pub permission_mode: Option<String>,
    pub model: Option<String>,
    /// claude session id to resume, so a restarted process keeps the conversation.
    pub resume: Option<String>,
}

/// Starts a long-lived claude process that reads user messages from stdin and
/// writes one JSON event per line to stdout.
pub fn spawn(binary: &ClaudeBinary, opts: &SpawnOptions) -> std::io::Result<Child> {
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
    cmd.current_dir(&opts.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
}
