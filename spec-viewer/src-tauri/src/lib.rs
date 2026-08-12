// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod app;
pub mod domain;
pub mod infrastructure;
pub mod presentation;

use app::use_cases::{
    diff_comments::DiffCommentUseCases, repository_diff::RepositoryDiffUseCases,
    spec_diff::SpecDiffUseCases, FilesystemAppUseCases,
};
use infrastructure::{
    filesystem::FilesystemSpecDiffTargetResolver, git::GitRepositoryAdapter,
    persistence::diff_comment_backend::FilesystemDiffCommentBackend,
};
use presentation::commands::{
    comments::{
        add_comment, delete_comment, export_comments, generate_llm_prompt, list_comments,
        reopen_comment, resolve_comment, update_comment,
    },
    diff_comments::{load_diff_comments, save_diff_comment, update_diff_comment},
    repository::{load_repository_diff, load_repository_file, traverse_repository_ignored},
    spec_diff::{
        get_spec_file_diff, list_changed_spec_files, list_spec_diff_revisions,
        list_spec_file_commit_history,
    },
    specs::{archive_spec, list_specs, load_spec_bundle, read_spec_file},
    watch::{start_spec_file_watch, stop_spec_file_watch},
    workspace::{load_workspace, validate_workspace_directory},
    CommandState,
};
use presentation::menu::build_application_menu;

fn command_state() -> CommandState {
    let git = GitRepositoryAdapter::default();
    CommandState::new(
        FilesystemAppUseCases::default(),
        RepositoryDiffUseCases::new(git.clone()),
        SpecDiffUseCases::new(FilesystemSpecDiffTargetResolver::new(), git.clone()),
        DiffCommentUseCases::new(FilesystemDiffCommentBackend::new(git)),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(build_application_menu)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(command_state())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            validate_workspace_directory,
            list_specs,
            load_spec_bundle,
            read_spec_file,
            archive_spec,
            start_spec_file_watch,
            stop_spec_file_watch,
            list_comments,
            add_comment,
            update_comment,
            delete_comment,
            resolve_comment,
            reopen_comment,
            export_comments,
            generate_llm_prompt,
            load_repository_diff,
            traverse_repository_ignored,
            load_repository_file,
            load_diff_comments,
            save_diff_comment,
            update_diff_comment,
            list_changed_spec_files,
            get_spec_file_diff,
            list_spec_diff_revisions,
            list_spec_file_commit_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
