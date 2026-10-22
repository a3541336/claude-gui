//! Messages written to claude's stdin (`--input-format stream-json`).
//! Output lines are forwarded to the frontend untouched, which owns their types.

use serde::Serialize;

#[derive(Serialize)]
pub struct UserInput<'a> {
    #[serde(rename = "type")]
    kind: &'static str,
    message: UserMessage<'a>,
}

#[derive(Serialize)]
struct UserMessage<'a> {
    role: &'static str,
    content: &'a str,
}

impl<'a> UserInput<'a> {
    pub fn text(content: &'a str) -> Self {
        Self {
            kind: "user",
            message: UserMessage {
                role: "user",
                content,
            },
        }
    }

    /// Serialized as one newline-terminated JSON line.
    pub fn to_line(&self) -> serde_json::Result<Vec<u8>> {
        let mut line = serde_json::to_vec(self)?;
        line.push(b'\n');
        Ok(line)
    }
}
