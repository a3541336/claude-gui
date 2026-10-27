use serde_json::Value;
use tauri::{AppHandle, State};

use crate::claude::oneshot::{self, StructuredQuery};
use crate::error::AppResult;
use crate::skills::{Skill, SkillStore};
use crate::state::{self, AppState};

#[tauri::command]
pub async fn list_skills(store: State<'_, SkillStore>) -> AppResult<Vec<Skill>> {
    store.list().await
}

#[tauri::command]
pub async fn save_skill(store: State<'_, SkillStore>, skill: Skill) -> AppResult<()> {
    store.save(skill).await
}

#[tauri::command]
pub async fn delete_skill(store: State<'_, SkillStore>, id: String) -> AppResult<()> {
    store.delete(&id).await
}

/// Asks claude one question and returns its answer as JSON matching `query.schema`.
#[tauri::command]
pub async fn ask_structured(
    app: AppHandle,
    state: State<'_, AppState>,
    query: StructuredQuery,
) -> AppResult<Value> {
    let binary = state.resolve_binary().await?;
    let cwd = state::resolve_cwd(&app, query.cwd.as_deref()).await?;
    oneshot::ask_structured(&binary, &cwd, &query).await
}
