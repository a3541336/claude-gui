mod claude;
mod commands;
mod error;
mod events;
mod history;
mod skills;
mod state;

use history::HistoryStore;
use skills::SkillStore;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            app.manage(HistoryStore::new(data_dir.join("history")));
            app.manage(SkillStore::new(data_dir.join("skills.json")));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::detect_claude,
            commands::system::set_claude_path,
            commands::system::update_claude,
            commands::auth::auth_status,
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::session::start_session,
            commands::session::send_message,
            commands::session::respond_to_request,
            commands::session::stop_session,
            commands::history::list_history,
            commands::history::save_history,
            commands::history::load_history,
            commands::history::delete_history,
            commands::skills::list_skills,
            commands::skills::save_skill,
            commands::skills::delete_skill,
            commands::skills::ask_structured,
            commands::project::read_claude_md,
            commands::project::write_claude_md,
            commands::project::append_claude_md,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
