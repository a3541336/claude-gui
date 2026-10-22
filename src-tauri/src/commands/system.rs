use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::error::AppResult;
use crate::state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeInfo {
    path: String,
    version: String,
}

#[tauri::command]
pub async fn detect_claude(state: State<'_, AppState>) -> AppResult<ClaudeInfo> {
    let binary = state.resolve_binary().await?;
    let version = match binary.version().await {
        Ok(version) => version,
        Err(err) => {
            state.clear_binary_cache().await;
            return Err(err);
        }
    };
    Ok(ClaudeInfo {
        path: binary.path.display().to_string(),
        version,
    })
}

/// `None` reverts to auto-detection.
#[tauri::command]
pub async fn set_claude_path(
    state: State<'_, AppState>,
    path: Option<String>,
) -> AppResult<ClaudeInfo> {
    *state.claude_path_override.lock().await = path.map(PathBuf::from);
    state.clear_binary_cache().await;
    detect_claude(state).await
}
