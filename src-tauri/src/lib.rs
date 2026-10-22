mod claude;
mod commands;
mod error;
mod events;
mod history;
mod state;

use history::HistoryStore;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            let dir = app.path().app_data_dir()?.join("history");
            app.manage(HistoryStore::new(dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::detect_claude,
            commands::system::set_claude_path,
            commands::session::start_session,
            commands::session::send_message,
            commands::session::respond_to_request,
            commands::session::stop_session,
            commands::history::list_history,
            commands::history::save_history,
            commands::history::load_history,
            commands::history::delete_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
