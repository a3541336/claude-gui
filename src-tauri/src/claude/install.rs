//! Installing the claude CLI with Anthropic's native installer.

use std::process::Stdio;
use std::time::Duration;

use tokio::process::Command;

use crate::error::{AppError, AppResult};

/// Downloads can be slow on a bad connection.
const INSTALL_TIMEOUT: Duration = Duration::from_secs(600);

/// Runs the official install script and returns its output. It installs into
/// the user's home directory, which `locator` checks, so no admin rights are needed.
pub async fn install() -> AppResult<String> {
    let mut cmd = installer_command();
    cmd.stdin(Stdio::null()).kill_on_drop(true);
    let output = match tokio::time::timeout(INSTALL_TIMEOUT, cmd.output()).await {
        Ok(output) => output?,
        Err(_) => return Err(AppError::InstallFailed("安裝逾時".into())),
    };
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::InstallFailed(if stderr.is_empty() { stdout } else { stderr }));
    }
    Ok(stdout)
}

#[cfg(unix)]
fn installer_command() -> Command {
    let mut cmd = Command::new("/bin/bash");
    cmd.args(["-c", "curl -fsSL https://claude.ai/install.sh | bash"]);
    cmd
}

#[cfg(windows)]
fn installer_command() -> Command {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "irm https://claude.ai/install.ps1 | iex",
    ]);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}
