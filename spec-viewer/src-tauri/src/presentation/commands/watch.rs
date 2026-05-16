//! File watch command DTOs and event emitters.

use std::{path::Path, str::FromStr};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::{
    app::services::file_watching::{
        FileWatchChange, FileWatchFailure, FileWatchNotification, FileWatchRegistration,
        FileWatchTargetKind,
    },
    domain::spec::SpecFileKey,
};

use super::{CommandError, CommandResult, CommandState};

const SPEC_FILE_WATCH_CHANGED_EVENT: &str = "spec-file-watch://changed";
const SPEC_FILE_WATCH_ERROR_EVENT: &str = "spec-file-watch://error";

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSpecFileWatchRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSpecFileWatchResponse {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    strategy: String,
    watched_paths: Vec<String>,
    skipped_paths: Vec<String>,
    debounce_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopSpecFileWatchRequest {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopSpecFileWatchResponse {
    stopped: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecFileWatchChangedEvent {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    change_kind: String,
    path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecFileWatchErrorEvent {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    message: String,
}

#[tauri::command]
pub fn start_spec_file_watch(
    app_handle: AppHandle,
    state: State<'_, CommandState>,
    request: StartSpecFileWatchRequest,
) -> CommandResult<StartSpecFileWatchResponse> {
    let file_key = SpecFileKey::from_str(&request.file_key).map_err(|_| {
        CommandError::invalid_request(format!("unsupported file key: {}", request.file_key))
    })?;
    let workspace = state
        .use_cases()
        .load_workspace(&request.workspace_path)
        .map_err(CommandError::from)?;
    let plan = state
        .use_cases()
        .plan_file_watch(&workspace, &request.spec_id, file_key)
        .map_err(CommandError::from)?;
    let use_cases = state.use_cases().clone();
    let registration = state
        .file_watch_manager()
        .replace_watch(plan, move |notification| {
            invalidate_markdown_cache(&use_cases, &notification);
            emit_file_watch_notification(&app_handle, notification);
        })
        .map_err(|error| CommandError::file_watch(error.to_string()))?;

    Ok(StartSpecFileWatchResponse::from(registration))
}

#[tauri::command]
pub fn stop_spec_file_watch(
    state: State<'_, CommandState>,
    _request: StopSpecFileWatchRequest,
) -> CommandResult<StopSpecFileWatchResponse> {
    state.file_watch_manager().stop();

    Ok(StopSpecFileWatchResponse { stopped: true })
}

fn emit_file_watch_notification(app_handle: &AppHandle, notification: FileWatchNotification) {
    match notification {
        FileWatchNotification::Changed(change) => {
            let _ = app_handle.emit(
                SPEC_FILE_WATCH_CHANGED_EVENT,
                SpecFileWatchChangedEvent::from(change),
            );
        }
        FileWatchNotification::Error(error) => {
            let _ = app_handle.emit(
                SPEC_FILE_WATCH_ERROR_EVENT,
                SpecFileWatchErrorEvent::from(error),
            );
        }
    }
}

fn invalidate_markdown_cache(
    use_cases: &crate::app::use_cases::FilesystemAppUseCases,
    notification: &FileWatchNotification,
) {
    let FileWatchNotification::Changed(change) = notification else {
        return;
    };

    match change.kind() {
        FileWatchTargetKind::Markdown => use_cases.markdown_cache().invalidate_path(change.path()),
        FileWatchTargetKind::Config => use_cases
            .markdown_cache()
            .clear_workspace(Path::new(change.scope().workspace_path())),
    }
}

impl From<FileWatchRegistration> for StartSpecFileWatchResponse {
    fn from(registration: FileWatchRegistration) -> Self {
        Self {
            workspace_path: registration.scope().workspace_path().to_string(),
            spec_id: registration.scope().spec_id().to_string(),
            file_key: registration.scope().file_key().as_str().to_string(),
            strategy: registration.strategy().as_str().to_string(),
            watched_paths: registration
                .watched_paths()
                .iter()
                .map(|path| display_path(path))
                .collect(),
            skipped_paths: registration
                .skipped_paths()
                .iter()
                .map(|path| display_path(path))
                .collect(),
            debounce_ms: registration.debounce_ms(),
        }
    }
}

impl From<FileWatchChange> for SpecFileWatchChangedEvent {
    fn from(change: FileWatchChange) -> Self {
        Self {
            workspace_path: change.scope().workspace_path().to_string(),
            spec_id: change.scope().spec_id().to_string(),
            file_key: change.scope().file_key().as_str().to_string(),
            change_kind: change.kind().as_str().to_string(),
            path: display_path(change.path()),
        }
    }
}

impl From<FileWatchFailure> for SpecFileWatchErrorEvent {
    fn from(error: FileWatchFailure) -> Self {
        Self {
            workspace_path: error.scope().workspace_path().to_string(),
            spec_id: error.scope().spec_id().to_string(),
            file_key: error.scope().file_key().as_str().to_string(),
            message: error.message().to_string(),
        }
    }
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::app::services::file_watching::{
        FileWatchScope, FileWatchStrategy, FileWatchTargetKind,
    };

    use super::*;

    #[test]
    fn watch_registration_response_uses_frontend_friendly_fields() {
        let registration = FileWatchRegistrationTestBuilder::new().build();

        let response = StartSpecFileWatchResponse::from(registration);

        assert_eq!("/workspace", response.workspace_path);
        assert_eq!("auth", response.spec_id);
        assert_eq!("tasks", response.file_key);
        assert_eq!("notify_debounced_parent_directories", response.strategy);
        assert_eq!(vec!["/workspace/auth"], response.watched_paths);
        assert_eq!(
            vec!["/workspace/.plugin-workspace/config.json"],
            response.skipped_paths
        );
        assert_eq!(250, response.debounce_ms);
    }

    #[test]
    fn changed_event_serializes_scope_and_change_kind() {
        let change = FileWatchChange::new_for_test(
            FileWatchScope::new("/workspace", "auth", SpecFileKey::Tasks),
            FileWatchTargetKind::Markdown,
            PathBuf::from("/workspace/auth/tasks.md"),
        );

        let event = SpecFileWatchChangedEvent::from(change);

        assert_eq!("/workspace", event.workspace_path);
        assert_eq!("auth", event.spec_id);
        assert_eq!("tasks", event.file_key);
        assert_eq!("markdown", event.change_kind);
        assert_eq!("/workspace/auth/tasks.md", event.path);
    }

    struct FileWatchRegistrationTestBuilder;

    impl FileWatchRegistrationTestBuilder {
        fn new() -> Self {
            Self
        }

        fn build(self) -> FileWatchRegistration {
            FileWatchRegistration::new_for_test(
                FileWatchScope::new("/workspace", "auth", SpecFileKey::Tasks),
                FileWatchStrategy::NotifyDebouncedParentDirectories,
                vec![PathBuf::from("/workspace/auth")],
                vec![PathBuf::from("/workspace/.plugin-workspace/config.json")],
                250,
            )
        }
    }
}
