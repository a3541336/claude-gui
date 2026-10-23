//! Short claude subcommands run to completion, e.g. `claude auth status`.

use std::process::{Output, Stdio};

use super::locator::ClaudeBinary;
use crate::error::{AppError, AppResult};

pub(super) async fn run(binary: &ClaudeBinary, args: &[&str]) -> AppResult<Vec<u8>> {
    let output = output(binary, args).await?;
    if !output.status.success() {
        return Err(failure(&output));
    }
    Ok(output.stdout)
}

pub(super) async fn output(binary: &ClaudeBinary, args: &[&str]) -> AppResult<Output> {
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
pub(super) fn failure(output: &Output) -> AppError {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let message = if stderr.is_empty() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        stderr
    };
    AppError::ClaudeFailed(message)
}
