//! Single questions answered by a short-lived claude process, outside any chat.

use std::path::PathBuf;
use std::process::Stdio;

use serde::Deserialize;
use serde_json::Value;
use tokio::io::AsyncWriteExt;

use super::locator::ClaudeBinary;
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredQuery {
    pub cwd: PathBuf,
    /// Answers with this session's context. The session is forked, so it is left unchanged.
    pub resume: Option<String>,
    pub model: Option<String>,
    pub prompt: String,
    /// JSON Schema the answer must match.
    pub schema: Value,
}

#[derive(Deserialize)]
struct ResultOutput {
    #[serde(default)]
    is_error: bool,
    #[serde(default)]
    result: Option<String>,
    structured_output: Option<Value>,
}

/// Returns the answer as a value matching `query.schema`.
pub async fn ask_structured(binary: &ClaudeBinary, query: &StructuredQuery) -> AppResult<Value> {
    let mut cmd = binary.command();
    cmd.args([
        "-p",
        "--output-format",
        "json",
        // Nothing to do but answer, and nothing worth keeping afterwards.
        "--tools",
        "",
        "--no-session-persistence",
        "--json-schema",
    ])
    .arg(serde_json::to_string(&query.schema)?);
    if let Some(model) = &query.model {
        cmd.args(["--model", model]);
    }
    if let Some(session_id) = &query.resume {
        cmd.args(["--resume", session_id, "--fork-session"]);
    }
    let mut child = cmd
        .current_dir(&query.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;

    // The prompt can be long, so it goes through stdin rather than argv.
    let mut stdin = child.stdin.take().expect("stdin is piped");
    stdin.write_all(query.prompt.as_bytes()).await?;
    drop(stdin);

    let output = child.wait_with_output().await?;
    let parsed = serde_json::from_slice::<ResultOutput>(&output.stdout).ok();
    match parsed {
        Some(ResultOutput {
            is_error: false,
            structured_output: Some(value),
            ..
        }) => Ok(value),
        Some(ResultOutput { result, .. }) => Err(AppError::ClaudeFailed(
            result.unwrap_or_else(|| "沒有產生結構化結果".into()),
        )),
        None => Err(AppError::ClaudeFailed(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        )),
    }
}
