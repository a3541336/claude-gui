//! Saved conversations, stored as JSON files in the app data directory:
//! `index.json` lists them and `conversations/<id>.json` holds each one's entries.
//! Entries are owned by the frontend and stored as-is.

use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};

const INDEX_FILE: &str = "index.json";
const CONVERSATIONS_DIR: &str = "conversations";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMeta {
    pub id: String,
    pub title: String,
    /// Working directory the conversation ran in; claude can only resume it from there.
    pub cwd: String,
    /// Time of the last user message, in ms since the epoch.
    pub updated_at: u64,
    pub claude_session_id: Option<String>,
    pub model: Option<String>,
}

pub struct HistoryStore {
    dir: PathBuf,
    /// Read from disk on first use. Holding the lock also serializes writes.
    index: Mutex<Option<Vec<ConversationMeta>>>,
}

impl HistoryStore {
    pub fn new(dir: PathBuf) -> Self {
        Self {
            dir,
            index: Mutex::new(None),
        }
    }

    /// Most recent first.
    pub async fn list(&self) -> AppResult<Vec<ConversationMeta>> {
        let mut index = self.index.lock().await;
        Ok(self.loaded(&mut index).await?.clone())
    }

    pub async fn save(&self, meta: ConversationMeta, entries: &Value) -> AppResult<()> {
        let path = self.entries_path(&meta.id)?;
        let mut index = self.index.lock().await;
        write_json(&path, entries).await?;
        let index = self.loaded(&mut index).await?;
        index.retain(|item| item.id != meta.id);
        index.push(meta);
        index.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        write_json(&self.dir.join(INDEX_FILE), index).await
    }

    /// The saved entries, or an empty list if the file is gone.
    pub async fn load(&self, id: &str) -> AppResult<Value> {
        let path = self.entries_path(id)?;
        Ok(read_json(&path).await?.unwrap_or(Value::Array(Vec::new())))
    }

    pub async fn delete(&self, id: &str) -> AppResult<()> {
        let path = self.entries_path(id)?;
        let mut index = self.index.lock().await;
        let index = self.loaded(&mut index).await?;
        index.retain(|item| item.id != id);
        write_json(&self.dir.join(INDEX_FILE), index).await?;
        match tokio::fs::remove_file(&path).await {
            Err(err) if err.kind() != ErrorKind::NotFound => Err(err.into()),
            _ => Ok(()),
        }
    }

    async fn loaded<'a>(
        &self,
        slot: &'a mut Option<Vec<ConversationMeta>>,
    ) -> AppResult<&'a mut Vec<ConversationMeta>> {
        if slot.is_none() {
            *slot = Some(read_json(&self.dir.join(INDEX_FILE)).await?.unwrap_or_default());
        }
        Ok(slot.get_or_insert_with(Vec::new))
    }

    fn entries_path(&self, id: &str) -> AppResult<PathBuf> {
        // Ids come from the frontend; keep them from escaping the directory.
        let valid = !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
        if !valid {
            return Err(AppError::InvalidHistoryId(id.to_string()));
        }
        Ok(self.dir.join(CONVERSATIONS_DIR).join(format!("{id}.json")))
    }
}

/// `None` when the file doesn't exist.
async fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> AppResult<Option<T>> {
    match tokio::fs::read(path).await {
        Ok(bytes) => Ok(Some(serde_json::from_slice(&bytes)?)),
        Err(err) if err.kind() == ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.into()),
    }
}

/// Writes to a temp file first so a crash never leaves a half-written file.
async fn write_json<T: Serialize + ?Sized>(path: &Path, value: &T) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let tmp = path.with_extension("json.tmp");
    tokio::fs::write(&tmp, serde_json::to_vec(value)?).await?;
    tokio::fs::rename(&tmp, path).await?;
    Ok(())
}
