//! Saved skills: reusable prompts with parameters, kept in `skills.json` in
//! the app data directory. They only run when the user picks one, so claude
//! never sees them on its own.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::error::AppResult;
use crate::history::{read_json, write_json};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillParam {
    /// Referenced in the prompt as `{{name}}`.
    pub name: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub default_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub params: Vec<SkillParam>,
    pub prompt: String,
    /// Directory of the conversation it was made from, offered when running it.
    pub source_cwd: Option<String>,
    /// In ms since the epoch.
    pub updated_at: u64,
}

pub struct SkillStore {
    path: PathBuf,
    /// Read from disk on first use. Holding the lock also serializes writes.
    skills: Mutex<Option<Vec<Skill>>>,
}

impl SkillStore {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            skills: Mutex::new(None),
        }
    }

    /// Most recently updated first.
    pub async fn list(&self) -> AppResult<Vec<Skill>> {
        let mut slot = self.skills.lock().await;
        Ok(self.loaded(&mut slot).await?.clone())
    }

    /// Adds the skill, or replaces the one with the same id.
    pub async fn save(&self, skill: Skill) -> AppResult<()> {
        let mut slot = self.skills.lock().await;
        let skills = self.loaded(&mut slot).await?;
        skills.retain(|s| s.id != skill.id);
        skills.push(skill);
        skills.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        write_json(&self.path, skills).await
    }

    pub async fn delete(&self, id: &str) -> AppResult<()> {
        let mut slot = self.skills.lock().await;
        let skills = self.loaded(&mut slot).await?;
        skills.retain(|s| s.id != id);
        write_json(&self.path, skills).await
    }

    async fn loaded<'a>(&self, slot: &'a mut Option<Vec<Skill>>) -> AppResult<&'a mut Vec<Skill>> {
        if slot.is_none() {
            *slot = Some(read_json(&self.path).await?.unwrap_or_default());
        }
        Ok(slot.get_or_insert_with(Vec::new))
    }
}
