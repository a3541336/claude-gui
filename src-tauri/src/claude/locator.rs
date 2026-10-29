//! Finds the `claude` executable on macOS and Windows.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tokio::process::Command;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct ClaudeBinary {
    pub path: PathBuf,
    /// PATH for the child process. Apps launched from Finder don't inherit the
    /// shell PATH, and an npm-installed claude needs it to find `node`.
    env_path: Option<OsString>,
}

impl ClaudeBinary {
    pub fn command(&self) -> Command {
        let cmd = if is_batch_script(&self.path) {
            // npm installs claude as a .cmd shim on Windows, which needs cmd.exe.
            let mut cmd = Command::new("cmd");
            cmd.arg("/C").arg(&self.path);
            cmd
        } else {
            Command::new(&self.path)
        };
        self.configure(cmd)
    }

    /// Another program run with the same environment as claude, e.g. its package manager.
    pub fn command_for(&self, program: &Path) -> Command {
        self.configure(Command::new(program))
    }

    fn configure(&self, mut cmd: Command) -> Command {
        if let Some(path) = &self.env_path {
            cmd.env("PATH", path);
        }
        #[cfg(windows)]
        {
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        cmd
    }

    pub async fn version(&self) -> AppResult<String> {
        let output = self.command().arg("--version").output().await?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(AppError::ClaudeNotRunnable(stderr));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
}

pub fn locate(override_path: Option<&Path>) -> AppResult<ClaudeBinary> {
    let path = match override_path {
        Some(path) if path.is_file() => path.to_path_buf(),
        Some(path) => return Err(AppError::InvalidClaudePath(path.display().to_string())),
        None => find().ok_or(AppError::ClaudeNotFound)?,
    };
    Ok(ClaudeBinary {
        env_path: child_path(&path),
        path,
    })
}

fn find() -> Option<PathBuf> {
    which::which("claude")
        .ok()
        .or_else(|| {
            let shell_path = login_shell_path()?;
            which::which_in("claude", Some(shell_path), std::env::temp_dir()).ok()
        })
        .or_else(|| candidates().into_iter().find(|path| path.is_file()))
}

/// Default install locations, checked when PATH lookup fails.
fn candidates() -> Vec<PathBuf> {
    let Some(home) = dirs::home_dir() else {
        return Vec::new();
    };
    if cfg!(windows) {
        vec![
            home.join(".local").join("bin").join("claude.exe"),
            home.join("AppData")
                .join("Roaming")
                .join("npm")
                .join("claude.cmd"),
        ]
    } else {
        vec![
            home.join(".local/bin/claude"),
            home.join(".claude/local/claude"),
            PathBuf::from("/opt/homebrew/bin/claude"),
            PathBuf::from("/usr/local/bin/claude"),
        ]
    }
}

/// The binary's own directory first, then the user's shell PATH.
fn child_path(binary: &Path) -> Option<OsString> {
    let base = login_shell_path()
        .cloned()
        .or_else(|| std::env::var_os("PATH"))?;
    let mut entries: Vec<PathBuf> = binary.parent().map(Path::to_path_buf).into_iter().collect();
    entries.extend(std::env::split_paths(&base));
    std::env::join_paths(entries).ok()
}

fn is_batch_script(path: &Path) -> bool {
    cfg!(windows)
        && path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat"))
}

fn login_shell_path() -> Option<&'static OsString> {
    static CACHE: OnceLock<Option<OsString>> = OnceLock::new();
    CACHE.get_or_init(read_login_shell_path).as_ref()
}

#[cfg(unix)]
fn read_login_shell_path() -> Option<OsString> {
    // Markers separate PATH from anything the shell's rc files print.
    const MARKER: &str = "__FLOWLOOM_PATH__";
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let output = std::process::Command::new(shell)
        .args(["-ilc", &format!("printf '{MARKER}%s{MARKER}' \"$PATH\"")])
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let start = text.find(MARKER)? + MARKER.len();
    let end = start + text[start..].find(MARKER)?;
    Some(OsString::from(&text[start..end]))
}

#[cfg(windows)]
fn read_login_shell_path() -> Option<OsString> {
    // GUI apps on Windows already inherit the user's PATH.
    None
}
