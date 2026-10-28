use serde_json::Value;
use tauri::{AppHandle, State};

use crate::claude::process::SpawnOptions;
use crate::error::AppResult;
use crate::state::{self, AppState};

#[tauri::command]
pub async fn start_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    options: SpawnOptions,
) -> AppResult<()> {
    let binary = state.resolve_binary().await?;
    let cwd = state::resolve_cwd(&app, options.cwd.as_deref()).await?;
    state
        .sessions
        .start(app, session_id, &binary, &cwd, &options)
        .await
}

#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    session_id: String,
    text: String,
) -> AppResult<()> {
    state.sessions.send(&session_id, &text).await
}

/// Answers a `control_request` from claude, e.g. a permission prompt.
#[tauri::command]
pub async fn respond_to_request(
    state: State<'_, AppState>,
    session_id: String,
    request_id: String,
    response: Value,
) -> AppResult<()> {
    state
        .sessions
        .respond(&session_id, &request_id, &response)
        .await
}

/// Switches a running process's permission mode without restarting it.
#[tauri::command]
pub async fn set_permission_mode(
    state: State<'_, AppState>,
    session_id: String,
    mode: String,
) -> AppResult<String> {
    state.sessions.set_permission_mode(&session_id, &mode).await
}

#[tauri::command]
pub async fn stop_session(state: State<'_, AppState>, session_id: String) -> AppResult<()> {
    state.sessions.stop(&session_id).await
}
