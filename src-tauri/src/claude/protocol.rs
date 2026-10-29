//! Messages written to claude's stdin (`--input-format stream-json`).
//! Output lines are forwarded to the frontend untouched, which owns their types.

use serde::Serialize;
use serde_json::Value;

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

    pub fn to_line(&self) -> serde_json::Result<Vec<u8>> {
        to_line(self)
    }
}

/// Answer to a `control_request`, such as a `can_use_tool` permission prompt.
#[derive(Serialize)]
pub struct ControlResponse<'a> {
    #[serde(rename = "type")]
    kind: &'static str,
    response: ControlResponseBody<'a>,
}

#[derive(Serialize)]
struct ControlResponseBody<'a> {
    subtype: &'static str,
    request_id: &'a str,
    /// Shaped by the request type; the frontend builds it.
    response: &'a Value,
}

impl<'a> ControlResponse<'a> {
    pub fn success(request_id: &'a str, response: &'a Value) -> Self {
        Self {
            kind: "control_response",
            response: ControlResponseBody {
                subtype: "success",
                request_id,
                response,
            },
        }
    }

    pub fn to_line(&self) -> serde_json::Result<Vec<u8>> {
        to_line(self)
    }
}

/// A request to claude, answered with a `control_response` on stdout.
#[derive(Serialize)]
pub struct ControlRequest<'a> {
    #[serde(rename = "type")]
    kind: &'static str,
    request_id: &'a str,
    request: ControlRequestBody<'a>,
}

#[derive(Serialize)]
#[serde(tag = "subtype", rename_all = "snake_case")]
enum ControlRequestBody<'a> {
    SetPermissionMode { mode: &'a str },
}

impl<'a> ControlRequest<'a> {
    /// Takes effect immediately, even in the middle of a turn.
    pub fn set_permission_mode(request_id: &'a str, mode: &'a str) -> Self {
        Self {
            kind: "control_request",
            request_id,
            request: ControlRequestBody::SetPermissionMode { mode },
        }
    }

    pub fn to_line(&self) -> serde_json::Result<Vec<u8>> {
        to_line(self)
    }
}

/// Serialized as one newline-terminated JSON line.
fn to_line<T: Serialize>(value: &T) -> serde_json::Result<Vec<u8>> {
    let mut line = serde_json::to_vec(value)?;
    line.push(b'\n');
    Ok(line)
}
