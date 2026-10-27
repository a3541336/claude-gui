use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("找不到 claude CLI，請先安裝並登入 Claude Code")]
    ClaudeNotFound,
    #[error("指定的 claude 路徑不存在：{0}")]
    InvalidClaudePath(String),
    #[error("無法執行 claude：{0}")]
    ClaudeNotRunnable(String),
    #[error("claude 執行失敗：{0}")]
    ClaudeFailed(String),
    #[error("工作階段不存在：{0}")]
    SessionNotFound(String),
    #[error("工作階段已存在：{0}")]
    SessionExists(String),
    #[error("不是資料夾：{0}")]
    NotADirectory(String),
    #[error("無效的對話紀錄 id：{0}")]
    InvalidHistoryId(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

// Commands return errors to the frontend as plain message strings.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
