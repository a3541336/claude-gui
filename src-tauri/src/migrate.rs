use std::path::{Path, PathBuf};

/// Bundle identifier used before the rename to FlowLoom.
const OLD_IDENTIFIER: &str = "tw.com.ruten.claudegui";

/// Moves data written under the old identifier to `data_dir`, once.
/// Best effort: a failure only means starting with empty history.
pub fn migrate_data_dir(data_dir: &Path) {
    let Some(old_dir) = data_dir.parent().map(|p| p.join(OLD_IDENTIFIER)) else {
        return;
    };
    if data_dir.exists() || !old_dir.is_dir() {
        return;
    }
    if std::fs::rename(&old_dir, data_dir).is_err() {
        return;
    }
    // claude keys conversations by cwd, so resuming project-less chats needs
    // its project folder to follow the chat directory.
    if let Some(projects) = dirs_home().map(|h| h.join(".claude").join("projects")) {
        let from = projects.join(project_key(&old_dir.join("chat")));
        let to = projects.join(project_key(&data_dir.join("chat")));
        if from.is_dir() && !to.exists() {
            let _ = std::fs::rename(from, to);
        }
    }
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

/// claude's project folder name: every non-alphanumeric character becomes `-`.
fn project_key(cwd: &Path) -> String {
    cwd.to_string_lossy()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}
