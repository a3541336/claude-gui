//! Events pushed from the backend to the frontend.
//! Names and payloads must stay in sync with `src/shared/api/claude.ts`.

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

/// One JSON line from claude's stdout, forwarded as-is.
pub const MESSAGE: &str = "claude:message";
/// stderr output, or a stdout line that isn't valid JSON.
pub const STDERR: &str = "claude:stderr";
/// The claude process has exited.
pub const EXIT: &str = "claude:exit";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessagePayload {
    pub session_id: String,
    pub line: Value,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StderrPayload {
    pub session_id: String,
    pub text: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExitPayload {
    pub session_id: String,
    /// `None` when the process was killed (e.g. stopped by the user).
    pub code: Option<i32>,
}

pub fn emit<P: Serialize + Clone>(app: &AppHandle, event: &str, payload: P) {
    if let Err(err) = app.emit(event, payload) {
        eprintln!("failed to emit {event}: {err}");
    }
}
