mod claude;
mod commands;
mod error;
mod events;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::system::detect_claude,
            commands::system::set_claude_path,
            commands::session::start_session,
            commands::session::send_message,
            commands::session::stop_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
