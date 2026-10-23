//! `claude auth` subcommands. Credentials stay with claude; this only asks it.

use std::time::Duration;

use serde_json::Value;

use super::cli::{failure, output, run};
use super::locator::ClaudeBinary;
use crate::error::{AppError, AppResult};

/// Long enough to finish signing in on the browser page claude opens.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

/// `claude auth status --json`, passed through as-is.
pub async fn status(binary: &ClaudeBinary) -> AppResult<Value> {
    let output = output(binary, &["auth", "status", "--json"]).await?;
    // Signed out, it still prints the status but exits with 1.
    match serde_json::from_slice(&output.stdout) {
        Ok(value) => Ok(value),
        Err(_) => Err(failure(&output)),
    }
}

pub async fn logout(binary: &ClaudeBinary) -> AppResult<()> {
    run(binary, &["auth", "logout"]).await.map(drop)
}

/// Opens the sign-in page in the browser and waits until it's done.
pub async fn login(binary: &ClaudeBinary) -> AppResult<()> {
    match tokio::time::timeout(LOGIN_TIMEOUT, run(binary, &["auth", "login"])).await {
        Ok(result) => result.map(drop),
        Err(_) => Err(AppError::ClaudeFailed("登入逾時".into())),
    }
}
