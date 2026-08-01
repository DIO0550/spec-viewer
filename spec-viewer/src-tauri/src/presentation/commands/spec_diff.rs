//! Tauri DTOs for Spec-scoped HEAD-to-working-tree diffs.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::spec_diff::{
        ChangedSpecFile, ChangedSpecFiles, SpecDiffUseCaseError, SpecFileDiff,
    },
    domain::repository::{FileChangeKind, RepositoryPortError},
    infrastructure::filesystem::SpecDiffTargetResolutionError,
};

use super::{repository::FileReviewResponse, CommandState};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListChangedSpecFilesRequest {
    workspace_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSpecFileDiffRequest {
    workspace_path: String,
    current_snapshot_id: String,
    spec_id: String,
    file_key: String,
    path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedSpecFileResponse {
    spec_id: String,
    file_key: String,
    target_path: String,
    old_path: Option<String>,
    new_path: Option<String>,
    change: &'static str,
}

impl From<ChangedSpecFile> for ChangedSpecFileResponse {
    fn from(value: ChangedSpecFile) -> Self {
        Self {
            spec_id: value.spec_id.as_str().to_string(),
            file_key: value.file_key.as_str().to_string(),
            target_path: value.target_path.as_str().to_string(),
            old_path: value.old_path.map(|path| path.as_str().to_string()),
            new_path: value.new_path.map(|path| path.as_str().to_string()),
            change: Self::change_name(value.change),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedSpecFilesResponse {
    current_snapshot_id: String,
    files: Vec<ChangedSpecFileResponse>,
}

impl From<ChangedSpecFiles> for ChangedSpecFilesResponse {
    fn from(value: ChangedSpecFiles) -> Self {
        Self {
            current_snapshot_id: value.current_snapshot_id.as_str().to_string(),
            files: value.files.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecFileDiffResponse {
    spec_id: String,
    file_key: String,
    review: FileReviewResponse,
}

impl From<SpecFileDiff> for SpecFileDiffResponse {
    fn from(value: SpecFileDiff) -> Self {
        Self {
            spec_id: value.spec_id.as_str().to_string(),
            file_key: value.file_key.as_str().to_string(),
            review: value.review.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SpecDiffCommandErrorCode {
    InvalidInput,
    WorkspaceDetection,
    ConfigLoad,
    SpecTreeScan,
    NotRepository,
    BareRepository,
    WorktreeUnavailable,
    CommonDirBoundaryEscape,
    UnbornHead,
    HeadChangedDuringRead,
    GitUnavailable,
    GitTimedOut,
    GitOutputLimitExceeded,
    GitFailed,
    UnsupportedPathEncoding,
    InvalidRepositoryPath,
    StaleBase,
    StaleSnapshot,
    EntryChangedDuringRead,
    PermissionDenied,
    Io,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecDiffCommandError {
    code: SpecDiffCommandErrorCode,
    message: String,
}

impl From<SpecDiffUseCaseError<SpecDiffTargetResolutionError>> for SpecDiffCommandError {
    fn from(error: SpecDiffUseCaseError<SpecDiffTargetResolutionError>) -> Self {
        let code = match &error {
            SpecDiffUseCaseError::InvalidInput | SpecDiffUseCaseError::ConflictingRenameTargets => {
                SpecDiffCommandErrorCode::InvalidInput
            }
            SpecDiffUseCaseError::Target(target) => match target {
                SpecDiffTargetResolutionError::WorkspaceDetection => {
                    SpecDiffCommandErrorCode::WorkspaceDetection
                }
                SpecDiffTargetResolutionError::ConfigLoad => SpecDiffCommandErrorCode::ConfigLoad,
                SpecDiffTargetResolutionError::SpecTreeScan => {
                    SpecDiffCommandErrorCode::SpecTreeScan
                }
                SpecDiffTargetResolutionError::AmbiguousSpecPath { .. }
                | SpecDiffTargetResolutionError::RepositoryBoundaryEscape => {
                    SpecDiffCommandErrorCode::InvalidInput
                }
                SpecDiffTargetResolutionError::UnsupportedPathEncoding => {
                    SpecDiffCommandErrorCode::UnsupportedPathEncoding
                }
                SpecDiffTargetResolutionError::Io => SpecDiffCommandErrorCode::Io,
            },
            SpecDiffUseCaseError::Repository(repository) => {
                SpecDiffCommandErrorCode::from_repository(repository)
            }
        };
        Self {
            code,
            message: error.to_string(),
        }
    }
}

impl SpecDiffCommandErrorCode {
    fn from_repository(error: &RepositoryPortError) -> Self {
        match error {
            RepositoryPortError::UnbornHead => Self::UnbornHead,
            RepositoryPortError::HeadChangedDuringRead => Self::HeadChangedDuringRead,
            RepositoryPortError::NotRepository => Self::NotRepository,
            RepositoryPortError::BareRepository => Self::BareRepository,
            RepositoryPortError::WorktreeUnavailable => Self::WorktreeUnavailable,
            RepositoryPortError::CommonDirBoundaryEscape => Self::CommonDirBoundaryEscape,
            RepositoryPortError::GitUnavailable => Self::GitUnavailable,
            RepositoryPortError::GitTimedOut { .. } => Self::GitTimedOut,
            RepositoryPortError::GitOutputLimitExceeded { .. } => Self::GitOutputLimitExceeded,
            RepositoryPortError::GitFailed { .. } => Self::GitFailed,
            RepositoryPortError::UnsupportedPathEncoding => Self::UnsupportedPathEncoding,
            RepositoryPortError::InvalidRepositoryPath => Self::InvalidRepositoryPath,
            RepositoryPortError::StaleBase => Self::StaleBase,
            RepositoryPortError::StaleSnapshot
            | RepositoryPortError::StaleCursor
            | RepositoryPortError::InvalidCursor => Self::StaleSnapshot,
            RepositoryPortError::EntryChangedDuringRead => Self::EntryChangedDuringRead,
            RepositoryPortError::PermissionDenied => Self::PermissionDenied,
            RepositoryPortError::Io => Self::Io,
        }
    }
}

impl ChangedSpecFileResponse {
    fn change_name(change: FileChangeKind) -> &'static str {
        match change {
            FileChangeKind::Added => "added",
            FileChangeKind::Modified => "modified",
            FileChangeKind::Deleted => "deleted",
            FileChangeKind::Renamed => "renamed",
            FileChangeKind::Copied => "copied",
            FileChangeKind::TypeChanged => "typeChanged",
            FileChangeKind::Untracked => "untracked",
        }
    }
}

#[tauri::command]
pub fn list_changed_spec_files(
    state: State<'_, CommandState>,
    request: ListChangedSpecFilesRequest,
) -> Result<ChangedSpecFilesResponse, SpecDiffCommandError> {
    state
        .spec_diff_use_cases()
        .list_changed_spec_files(&request.workspace_path)
        .map(Into::into)
        .map_err(Into::into)
}

#[tauri::command]
pub fn get_spec_file_diff(
    state: State<'_, CommandState>,
    request: GetSpecFileDiffRequest,
) -> Result<SpecFileDiffResponse, SpecDiffCommandError> {
    state
        .spec_diff_use_cases()
        .get_spec_file_diff(
            &request.workspace_path,
            &request.current_snapshot_id,
            &request.spec_id,
            &request.file_key,
            &request.path,
        )
        .map(Into::into)
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_use_camel_case_contract() {
        let request: GetSpecFileDiffRequest = serde_json::from_value(serde_json::json!({
            "workspacePath": "/repo",
            "currentSnapshotId": format!("rs1_{}", "0".repeat(64)),
            "specId": "001-feature",
            "fileKey": "tasks",
            "path": ".plugin-workspace/.specs/001-feature/tasks.md"
        }))
        .unwrap();
        assert_eq!(request.spec_id, "001-feature");
        assert_eq!(request.file_key, "tasks");
    }

    #[test]
    fn command_error_codes_serialize_as_camel_case() {
        let cases = [
            (SpecDiffCommandErrorCode::UnbornHead, "unbornHead"),
            (
                SpecDiffCommandErrorCode::HeadChangedDuringRead,
                "headChangedDuringRead",
            ),
            (SpecDiffCommandErrorCode::StaleSnapshot, "staleSnapshot"),
            (
                SpecDiffCommandErrorCode::UnsupportedPathEncoding,
                "unsupportedPathEncoding",
            ),
        ];
        for (code, expected) in cases {
            assert_eq!(serde_json::to_value(code).unwrap(), expected);
        }
    }

    #[test]
    fn changed_file_response_exposes_detail_target_path() {
        let response = ChangedSpecFileResponse::from(ChangedSpecFile {
            spec_id: crate::domain::spec::SpecId::new("001-feature").unwrap(),
            file_key: crate::domain::spec::SpecFileKey::Tasks,
            target_path: crate::domain::repository::RepositoryRelativePath::parse(
                "specs/001/tasks.md",
            )
            .unwrap(),
            old_path: Some(
                crate::domain::repository::RepositoryRelativePath::parse("specs/001/tasks.md")
                    .unwrap(),
            ),
            new_path: Some(
                crate::domain::repository::RepositoryRelativePath::parse("specs/001/work.md")
                    .unwrap(),
            ),
            change: FileChangeKind::Renamed,
        });

        let json = serde_json::to_value(response).unwrap();
        assert_eq!(json["targetPath"], "specs/001/tasks.md");
    }

    #[test]
    fn unborn_head_maps_to_typed_command_error() {
        let error = SpecDiffCommandError::from(SpecDiffUseCaseError::Repository(
            RepositoryPortError::UnbornHead,
        ));
        assert_eq!(error.code, SpecDiffCommandErrorCode::UnbornHead);
    }
}
