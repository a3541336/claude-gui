//! Files the user drops onto the window.

use tauri::ipc::Response;

use crate::error::{AppError, AppResult};

/// Larger files are refused before reading; the frontend shrinks what it gets anyway.
const MAX_IMAGE_BYTES: u64 = 50 * 1024 * 1024;

/// The raw bytes of a dropped image, sent as binary rather than a JSON array.
#[tauri::command]
pub async fn read_image_file(path: String) -> AppResult<Response> {
    let meta = tokio::fs::metadata(&path).await?;
    if meta.len() > MAX_IMAGE_BYTES {
        return Err(AppError::FileTooLarge(path));
    }
    Ok(Response::new(tokio::fs::read(&path).await?))
}
