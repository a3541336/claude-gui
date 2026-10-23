use serde_json::Value;
use tauri::State;

use crate::claude::auth;
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn auth_status(state: State<'_, AppState>) -> AppResult<Value> {
    auth::status(&state.resolve_binary().await?).await
}

#[tauri::command]
pub async fn auth_login(state: State<'_, AppState>) -> AppResult<()> {
    auth::login(&state.resolve_binary().await?).await
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, AppState>) -> AppResult<()> {
    auth::logout(&state.resolve_binary().await?).await
}
