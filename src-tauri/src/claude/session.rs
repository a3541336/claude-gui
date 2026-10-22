//! Tracks running claude processes and pipes their output to the frontend.

use std::collections::HashMap;
use std::sync::Arc;

use serde_json::Value;
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout};
use tokio::sync::Mutex;

use super::locator::ClaudeBinary;
use super::process::{self, SpawnOptions};
use super::protocol::UserInput;
use crate::error::{AppError, AppResult};
use crate::events::{self, ExitPayload, MessagePayload, StderrPayload};

struct Session {
    child: Child,
    stdin: ChildStdin,
}

type SessionMap = Arc<Mutex<HashMap<String, Session>>>;

#[derive(Default)]
pub struct SessionManager {
    sessions: SessionMap,
}

impl SessionManager {
    /// `id` is chosen by the frontend so it can match events that arrive
    /// before this call returns.
    pub async fn start(
        &self,
        app: AppHandle,
        id: String,
        binary: &ClaudeBinary,
        opts: &SpawnOptions,
    ) -> AppResult<()> {
        let mut sessions = self.sessions.lock().await;
        if sessions.contains_key(&id) {
            return Err(AppError::SessionExists(id));
        }

        let mut child = process::spawn(binary, opts)?;
        let (Some(stdin), Some(stdout), Some(stderr)) =
            (child.stdin.take(), child.stdout.take(), child.stderr.take())
        else {
            unreachable!("stdio is piped in process::spawn");
        };
        sessions.insert(id.clone(), Session { child, stdin });

        tauri::async_runtime::spawn(forward_stderr(app.clone(), id.clone(), stderr));
        tauri::async_runtime::spawn(forward_stdout(app, id, stdout, self.sessions.clone()));
        Ok(())
    }

    pub async fn send(&self, id: &str, text: &str) -> AppResult<()> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| AppError::SessionNotFound(id.to_string()))?;
        session
            .stdin
            .write_all(&UserInput::text(text).to_line()?)
            .await?;
        session.stdin.flush().await?;
        Ok(())
    }

    /// Kills the process; the stdout task then emits the exit event.
    pub async fn stop(&self, id: &str) -> AppResult<()> {
        if let Some(mut session) = self.sessions.lock().await.remove(id) {
            session.child.start_kill()?;
        }
        Ok(())
    }
}

async fn forward_stdout(app: AppHandle, id: String, stdout: ChildStdout, sessions: SessionMap) {
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Value>(&line) {
            Ok(value) => events::emit(
                &app,
                events::MESSAGE,
                MessagePayload {
                    session_id: id.clone(),
                    line: value,
                },
            ),
            Err(_) => events::emit(
                &app,
                events::STDERR,
                StderrPayload {
                    session_id: id.clone(),
                    text: line,
                },
            ),
        }
    }

    // Still in the map means the process exited on its own rather than via stop().
    let session = sessions.lock().await.remove(&id);
    let code = match session {
        Some(mut session) => session
            .child
            .wait()
            .await
            .ok()
            .and_then(|status| status.code()),
        None => None,
    };
    events::emit(
        &app,
        events::EXIT,
        ExitPayload {
            session_id: id,
            code,
        },
    );
}

async fn forward_stderr(app: AppHandle, id: String, stderr: ChildStderr) {
    let mut lines = BufReader::new(stderr).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        events::emit(
            &app,
            events::STDERR,
            StderrPayload {
                session_id: id.clone(),
                text: line,
            },
        );
    }
}
