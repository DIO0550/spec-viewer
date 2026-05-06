// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod app;
pub mod domain;
pub mod infrastructure;
pub mod presentation;

use presentation::commands::{
    comments::{
        add_comment, delete_comment, export_comments, generate_llm_prompt, list_comments,
        reopen_comment, resolve_comment, toggle_comment_resolved, update_comment,
    },
    review_runs::{archive_review_run, create_review_run, list_review_runs},
    specs::{list_specs, read_spec_file},
    watch::{start_spec_file_watch, stop_spec_file_watch},
    workspace::{load_workspace, validate_workspace_directory},
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
            validate_workspace_directory,
            list_specs,
            read_spec_file,
            start_spec_file_watch,
            stop_spec_file_watch,
            list_comments,
            add_comment,
            update_comment,
            delete_comment,
            resolve_comment,
            reopen_comment,
            toggle_comment_resolved,
            export_comments,
            generate_llm_prompt,
            create_review_run,
            list_review_runs,
            archive_review_run
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
