//! Tauri command handlers and DTOs.

pub mod comments;
pub mod specs;
pub mod user_reviews;
pub mod watch;
pub mod workspace;

use std::sync::Arc;

use serde::Serialize;

use crate::app::{
    services::file_watching::FileWatchManager,
    use_cases::{AppUseCaseError, FilesystemAppUseCases},
};

pub type CommandResult<T> = Result<T, CommandError>;

#[derive(Debug, Clone, Default)]
pub struct CommandState {
    use_cases: FilesystemAppUseCases,
    file_watch_manager: Arc<FileWatchManager>,
}

impl CommandState {
    pub fn new(use_cases: FilesystemAppUseCases) -> Self {
        Self {
            use_cases,
            file_watch_manager: Arc::new(FileWatchManager::new()),
        }
    }

    pub fn use_cases(&self) -> &FilesystemAppUseCases {
        &self.use_cases
    }

    pub fn file_watch_manager(&self) -> &FileWatchManager {
        &self.file_watch_manager
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    code: String,
    message: String,
}

impl CommandError {
    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: "invalidRequest".to_string(),
            message: message.into(),
        }
    }

    pub fn file_watch(message: impl Into<String>) -> Self {
        Self {
            code: "fileWatch".to_string(),
            message: message.into(),
        }
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

impl From<AppUseCaseError> for CommandError {
    fn from(error: AppUseCaseError) -> Self {
        let code = match error {
            AppUseCaseError::WorkspaceDetection { .. } => "workspaceDetection",
            AppUseCaseError::ConfigLoad { .. } => "configLoad",
            AppUseCaseError::SpecTreeScan { .. } => "specTreeScan",
            AppUseCaseError::SpecArchive { .. } => "specArchive",
            AppUseCaseError::MarkdownRead { .. } => "markdownRead",
            AppUseCaseError::InvalidSpec { .. } => "invalidSpec",
            AppUseCaseError::InvalidComment { .. } => "invalidComment",
            AppUseCaseError::CommentRepository { .. } => "commentRepository",
            AppUseCaseError::ReviewRunExport { .. } => "userReviewExport",
            AppUseCaseError::UserReview { ref source } => match source {
                crate::app::use_cases::UserReviewUseCaseError::CreateIdCollision { .. } => {
                    "userReviewCollision"
                }
                crate::app::use_cases::UserReviewUseCaseError::Repository(_) => {
                    "userReviewRepository"
                }
                _ => "invalidUserReview",
            },
        };

        Self {
            code: code.to_string(),
            message: error.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_error_maps_app_errors_to_stable_codes() {
        let error = CommandError::from(AppUseCaseError::MarkdownRead {
            message: "file is not valid UTF-8".to_string(),
        });

        assert_eq!("markdownRead", error.code());
        assert_eq!(
            "failed to read spec file: file is not valid UTF-8",
            error.message()
        );
    }

    #[test]
    fn command_error_maps_archive_failures_to_stable_code() {
        let error = CommandError::from(AppUseCaseError::SpecArchive {
            message: "spec directory does not exist".to_string(),
        });

        assert_eq!("specArchive", error.code());
        assert_eq!(
            "failed to archive spec: spec directory does not exist",
            error.message()
        );
    }

    #[test]
    fn invalid_request_error_uses_frontend_friendly_code() {
        let error = CommandError::invalid_request("unsupported file key: notes");

        assert_eq!("invalidRequest", error.code());
        assert_eq!("unsupported file key: notes", error.message());
    }
}
