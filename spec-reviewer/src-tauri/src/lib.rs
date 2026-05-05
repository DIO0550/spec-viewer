// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod app;
pub mod domain;
pub mod infrastructure;
pub mod presentation;

use presentation::commands::{
    specs::{list_specs, read_spec_file},
    workspace::load_workspace,
    CommandState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(CommandState::default())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            list_specs,
            read_spec_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
