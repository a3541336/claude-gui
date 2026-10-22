use std::path::PathBuf;

use tokio::sync::Mutex;

use crate::claude::locator::{self, ClaudeBinary};
use crate::claude::session::SessionManager;
use crate::error::AppResult;

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
