//! Updating the claude CLI itself.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use super::cli::{failure, run};
use super::locator::ClaudeBinary;
use crate::error::{AppError, AppResult};

/// Downloads can be slow on a bad connection.
const UPDATE_TIMEOUT: Duration = Duration::from_secs(600);

/// Homebrew installs go through `brew upgrade`, since `claude update` only
/// prints instructions for them. Everything else uses `claude update`.
/// Fails if the version is unchanged afterwards, with the tool's output as the reason.
pub async fn update(binary: &ClaudeBinary) -> AppResult<String> {
    let before = binary.version().await?;
    let output = match tokio::time::timeout(UPDATE_TIMEOUT, run_update(binary)).await {
        Ok(output) => output?,
        Err(_) => return Err(AppError::ClaudeFailed("更新逾時".into())),
    };
    if binary.version().await? == before {
        return Err(AppError::ClaudeFailed(output));
    }
    Ok(output)
}

async fn run_update(binary: &ClaudeBinary) -> AppResult<String> {
    let stdout = match homebrew_cask(&binary.path) {
        Some((brew, cask)) => {
            let output = binary
                .command_for(&brew)
                .args(["upgrade", "--cask", &cask])
                .stdin(Stdio::null())
                .kill_on_drop(true)
                .output()
                .await?;
            if !output.status.success() {
                return Err(failure(&output));
            }
            output.stdout
        }
        None => run(binary, &["update"]).await?,
    };
    Ok(String::from_utf8_lossy(&stdout).trim().to_string())
}

/// `<prefix>/Caskroom/<cask>/<version>/claude` → (`<prefix>/bin/brew`, `<cask>`),
/// following the `<prefix>/bin/claude` symlink.
fn homebrew_cask(path: &Path) -> Option<(PathBuf, String)> {
    let real = std::fs::canonicalize(path).ok()?;
    let parts: Vec<_> = real.components().collect();
    let i = parts.iter().position(|c| c.as_os_str() == "Caskroom")?;
    let cask = parts.get(i + 1)?.as_os_str().to_str()?.to_string();
    let brew = parts[..i].iter().collect::<PathBuf>().join("bin/brew");
    brew.is_file().then_some((brew, cask))
}
