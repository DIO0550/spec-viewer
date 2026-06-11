//! Application-level use case errors and their infrastructure mappings.

use thiserror::Error;

use crate::{
    domain::{
        comment::{CommentDomainError, CommentRepositoryError},
        spec::{SafeSpecPathError, SpecDomainError},
    },
    infrastructure::{
        filesystem::{SpecArchiveError, SpecTreeScanError, WorkspaceDetectionError},
        markdown::MarkdownReadError,
        persistence::config::ConfigLoadError,
    },
};

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum AppUseCaseError {
    #[error("failed to detect workspace: {message}")]
    WorkspaceDetection { message: String },
    #[error("failed to load workspace config: {message}")]
    ConfigLoad { message: String },
    #[error("failed to scan spec tree: {message}")]
    SpecTreeScan { message: String },
    #[error("failed to archive spec: {message}")]
    SpecArchive { message: String },
    #[error("failed to read spec file: {message}")]
    MarkdownRead { message: String },
    #[error("invalid spec input: {message}")]
    InvalidSpec { message: String },
    #[error("invalid comment input: {message}")]
    InvalidComment { message: String },
    #[error("failed to persist comments: {message}")]
    CommentRepository { message: String },
    #[error("failed to export review run: {message}")]
    ReviewRunExport { message: String },
}

impl From<WorkspaceDetectionError> for AppUseCaseError {
    fn from(source: WorkspaceDetectionError) -> Self {
        Self::WorkspaceDetection {
            message: source.to_string(),
        }
    }
}

impl From<ConfigLoadError> for AppUseCaseError {
    fn from(source: ConfigLoadError) -> Self {
        Self::ConfigLoad {
            message: source.to_string(),
        }
    }
}

impl From<SpecTreeScanError> for AppUseCaseError {
    fn from(source: SpecTreeScanError) -> Self {
        if matches!(source, SpecTreeScanError::ConfigOverrideLoad { .. }) {
            return Self::ConfigLoad {
                message: source.to_string(),
            };
        }

        Self::SpecTreeScan {
            message: source.to_string(),
        }
    }
}

impl From<SafeSpecPathError> for AppUseCaseError {
    fn from(source: SafeSpecPathError) -> Self {
        Self::InvalidSpec {
            message: source.to_string(),
        }
    }
}

impl From<SpecArchiveError> for AppUseCaseError {
    fn from(source: SpecArchiveError) -> Self {
        Self::SpecArchive {
            message: source.to_string(),
        }
    }
}

impl From<MarkdownReadError> for AppUseCaseError {
    fn from(source: MarkdownReadError) -> Self {
        Self::MarkdownRead {
            message: source.to_string(),
        }
    }
}

impl From<SpecDomainError> for AppUseCaseError {
    fn from(source: SpecDomainError) -> Self {
        Self::InvalidSpec {
            message: source.to_string(),
        }
    }
}

impl From<CommentDomainError> for AppUseCaseError {
    fn from(source: CommentDomainError) -> Self {
        Self::InvalidComment {
            message: source.to_string(),
        }
    }
}

impl From<CommentRepositoryError> for AppUseCaseError {
    fn from(source: CommentRepositoryError) -> Self {
        Self::CommentRepository {
            message: source.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::spec::SpecFileKey;

    #[test]
    fn infrastructure_errors_map_to_app_level_errors() {
        let error = AppUseCaseError::from(WorkspaceDetectionError::UnsupportedWorkspace {
            root: "/workspace/project".to_string(),
        });

        assert_eq!(
            AppUseCaseError::WorkspaceDetection {
                message: "unsupported workspace layout at: /workspace/project".to_string()
            },
            error
        );
    }

    #[test]
    fn spec_config_override_scan_errors_map_to_config_load_errors() {
        let source = SpecTreeScanError::ConfigOverrideLoad {
            path: "/workspace/project/.plugin-workspace/.specs/auth".to_string(),
            source: ConfigLoadError::InvalidFileMapping {
                path: "/workspace/project/.plugin-workspace/.specs/auth/.spec-reviewer/config.json"
                    .to_string(),
                source: crate::domain::workspace::WorkspaceConfigError::UnsafeFileName {
                    key: SpecFileKey::Tasks,
                    file_name: "../tasks.md".to_string(),
                },
            },
        };

        let error = AppUseCaseError::from(source);

        assert!(matches!(error, AppUseCaseError::ConfigLoad { .. }));
    }
}
