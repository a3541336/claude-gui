//! The project's `CLAUDE.md`, which claude reads as standing instructions at
//! the start of every session in that directory. Chats without a project
//! share the one in [`state::chat_dir`].

use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use tauri::AppHandle;

use crate::error::{AppError, AppResult};
use crate::state;

const FILE_NAME: &str = "CLAUDE.md";

/// The file's content, or `None` if there is none yet.
#[tauri::command]
pub async fn read_claude_md(app: AppHandle, cwd: Option<String>) -> AppResult<Option<String>> {
    read(&claude_md_path(&app, cwd).await?).await
}

/// Creates the file if needed.
#[tauri::command]
pub async fn write_claude_md(app: AppHandle, cwd: Option<String>, content: String) -> AppResult<()> {
    write(&claude_md_path(&app, cwd).await?, &content).await
}

/// Adds `note` as a list item at the end, like the CLI's `#` shortcut.
#[tauri::command]
pub async fn append_claude_md(app: AppHandle, cwd: Option<String>, note: String) -> AppResult<()> {
    let path = claude_md_path(&app, cwd).await?;
    let existing = read(&path).await?.unwrap_or_default();
    let base = existing.trim_end();
    let separator = if base.is_empty() { "" } else { "\n" };
    write(&path, &format!("{base}{separator}- {}\n", note.trim())).await
}

async fn read(path: &Path) -> AppResult<Option<String>> {
    match tokio::fs::read_to_string(path).await {
        Ok(text) => Ok(Some(text)),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.into()),
    }
}

/// Writes to a temp file first so a crash never leaves it half-written.
async fn write(path: &Path, content: &str) -> AppResult<()> {
    let tmp = path.with_extension("md.tmp");
    tokio::fs::write(&tmp, content).await?;
    tokio::fs::rename(&tmp, path).await?;
    Ok(())
}

async fn claude_md_path(app: &AppHandle, cwd: Option<String>) -> AppResult<PathBuf> {
    let dir = state::resolve_cwd(app, cwd.as_deref().map(Path::new)).await?;
    if !tokio::fs::metadata(&dir).await.is_ok_and(|m| m.is_dir()) {
        return Err(AppError::NotADirectory(dir.display().to_string()));
    }
    Ok(dir.join(FILE_NAME))
}
