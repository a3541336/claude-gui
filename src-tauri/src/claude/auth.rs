//! `claude auth` subcommands. Credentials stay with claude; this only asks it.

use std::process::{Output, Stdio};
use std::time::Duration;

use serde_json::Value;

use super::locator::ClaudeBinary;
use crate::error::{AppError, AppResult};

/// Long enough to finish signing in on the browser page claude opens.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

/// `claude auth status --json`, passed through as-is.
pub async fn status(binary: &ClaudeBinary) -> AppResult<Value> {
    let output = command(binary, &["auth", "status", "--json"]).await?;
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

async fn run(binary: &ClaudeBinary, args: &[&str]) -> AppResult<Vec<u8>> {
    let output = command(binary, args).await?;
    if !output.status.success() {
        return Err(failure(&output));
    }
    Ok(output.stdout)
}

async fn command(binary: &ClaudeBinary, args: &[&str]) -> AppResult<Output> {
    Ok(binary
        .command()
        .args(args)
        // Nothing can answer a prompt, so fail rather than wait for input.
        .stdin(Stdio::null())
        .kill_on_drop(true)
        .output()
        .await?)
}

/// claude sometimes reports errors on stdout only.
fn failure(output: &Output) -> AppError {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let message = if stderr.is_empty() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        stderr
    };
    AppError::ClaudeFailed(message)
}
