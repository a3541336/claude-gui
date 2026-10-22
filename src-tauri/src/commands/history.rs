use serde_json::Value;
use tauri::State;

use crate::error::AppResult;
use crate::history::{ConversationMeta, HistoryStore};

#[tauri::command]
pub async fn list_history(store: State<'_, HistoryStore>) -> AppResult<Vec<ConversationMeta>> {
    store.list().await
}

#[tauri::command]
pub async fn save_history(
    store: State<'_, HistoryStore>,
    meta: ConversationMeta,
    entries: Value,
) -> AppResult<()> {
    store.save(meta, &entries).await
}

#[tauri::command]
pub async fn load_history(store: State<'_, HistoryStore>, id: String) -> AppResult<Value> {
    store.load(&id).await
}

#[tauri::command]
pub async fn delete_history(store: State<'_, HistoryStore>, id: String) -> AppResult<()> {
    store.delete(&id).await
}
