//! Updating the claude CLI itself.

use std::time::Duration;

use super::cli::run;
use super::locator::ClaudeBinary;
use crate::error::{AppError, AppResult};

/// Downloads can be slow on a bad connection.
const UPDATE_TIMEOUT: Duration = Duration::from_secs(600);

/// `claude update`, which goes through the package manager for npm or brew installs.
pub async fn update(binary: &ClaudeBinary) -> AppResult<String> {
    match tokio::time::timeout(UPDATE_TIMEOUT, run(binary, &["update"])).await {
        Ok(stdout) => Ok(String::from_utf8_lossy(&stdout?).trim().to_string()),
        Err(_) => Err(AppError::ClaudeFailed("更新逾時".into())),
    }
}
