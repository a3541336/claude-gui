use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::claude::locator::{self, ClaudeBinary};
use crate::claude::session::SessionManager;
use crate::error::AppResult;

/// Where claude runs for conversations without a project: an empty directory
/// of our own, so it neither reads nor changes the user's files by accident.
/// A resumed conversation must run in the same directory, so this never changes.
pub async fn chat_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app.path().app_data_dir()?.join("chat");
    tokio::fs::create_dir_all(&dir).await?;
    Ok(dir)
}

/// `cwd`, or [`chat_dir`] when there is none.
pub async fn resolve_cwd(app: &AppHandle, cwd: Option<&Path>) -> AppResult<PathBuf> {
    match cwd {
        Some(cwd) => Ok(cwd.to_path_buf()),
        None => chat_dir(app).await,
    }
}

#[derive(Default)]
pub struct AppState {
    /// Path chosen by the user; takes precedence over auto-detection.
    pub claude_path_override: Mutex<Option<PathBuf>>,
    /// Cached result of the last successful lookup.
    claude_binary: Mutex<Option<ClaudeBinary>>,
    pub sessions: SessionManager,
}

impl AppState {
    pub async fn resolve_binary(&self) -> AppResult<ClaudeBinary> {
        if let Some(binary) = self.claude_binary.lock().await.clone() {
            return Ok(binary);
        }
        let override_path = self.claude_path_override.lock().await.clone();
        // Lookup may run a login shell, so keep it off the async workers.
        let binary =
            tauri::async_runtime::spawn_blocking(move || locator::locate(override_path.as_deref()))
                .await??;
        *self.claude_binary.lock().await = Some(binary.clone());
        Ok(binary)
    }

    pub async fn clear_binary_cache(&self) {
        *self.claude_binary.lock().await = None;
    }
}
