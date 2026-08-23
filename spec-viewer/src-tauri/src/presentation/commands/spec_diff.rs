//! Tauri DTOs for Spec-scoped HEAD-to-working-tree diffs.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::spec_diff::{
        ChangedSpecFile, ChangedSpecFiles, SpecDiffUseCaseError, SpecFileDiff,
    },
    domain::{
        comment::diff::DiffReviewIdentity,
        repository::{
            CommitSha, ComparisonRevision, RepositoryPortError, RevisionOption, SpecFileCommit,
            SpecFileHistory,
        },
        workspace::ValidatedRefName,
    },
    infrastructure::filesystem::SpecDiffTargetResolutionError,
};

use super::{
    repository::{FileChangeKindResponseToken, FileReviewResponse},
    CommandState,
};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListChangedSpecFilesRequest {
    workspace_path: String,
    #[serde(default)]
    comparison: Option<ComparisonRevisionRequest>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ComparisonRevisionRequest {
    Head,
    Commit { sha: String },
    LocalBranch { name: String },
    Tag { name: String },
}

impl ComparisonRevisionRequest {
    fn into_domain(self) -> Result<ComparisonRevision, SpecDiffCommandError> {
        let invalid = || SpecDiffCommandError {
            code: SpecDiffCommandErrorCode::InvalidInput,
            message: "invalid comparison revision".into(),
        };
        match self {
            Self::Head => Ok(ComparisonRevision::Head),
            Self::Commit { sha } => CommitSha::parse(sha)
                .map(ComparisonRevision::Commit)
                .map_err(|_| invalid()),
            Self::LocalBranch { name } => ValidatedRefName::parse(name)
                .map_err(|_| invalid())
                .and_then(|reference| {
                    ComparisonRevision::local_branch(reference).map_err(|_| invalid())
                }),
            Self::Tag { name } => ValidatedRefName::parse(name)
                .map_err(|_| invalid())
                .and_then(|reference| ComparisonRevision::tag(reference).map_err(|_| invalid())),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSpecFileDiffRequest {
    workspace_path: String,
    current_snapshot_id: String,
    #[serde(default)]
    resolved_base_sha: Option<String>,
    spec_id: String,
    file_key: String,
    path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSpecDiffRevisionsRequest {
    workspace_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSpecFileCommitHistoryRequest {
    workspace_path: String,
    spec_id: String,
    file_key: String,
    path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ComparisonRevisionResponse {
    Head,
    Commit { sha: String },
    LocalBranch { name: String },
    Tag { name: String },
}

impl From<ComparisonRevision> for ComparisonRevisionResponse {
    fn from(value: ComparisonRevision) -> Self {
        match value {
            ComparisonRevision::Head => Self::Head,
            ComparisonRevision::Commit(commit) => Self::Commit {
                sha: commit.as_str().to_string(),
            },
            ComparisonRevision::LocalBranch(reference) => Self::LocalBranch {
                name: reference.as_str().to_string(),
            },
            ComparisonRevision::Tag(reference) => Self::Tag {
                name: reference.as_str().to_string(),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionOptionResponse {
    revision: ComparisonRevisionResponse,
    label: String,
    resolved_commit_sha: String,
}

impl From<RevisionOption> for RevisionOptionResponse {
    fn from(value: RevisionOption) -> Self {
        Self {
            revision: value.revision.into(),
            label: value.label,
            resolved_commit_sha: value.resolved_commit.as_str().to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionOptionsResponse {
    options: Vec<RevisionOptionResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecFileCommitResponse {
    sha: String,
    committed_at: String,
    message: String,
}

impl From<SpecFileCommit> for SpecFileCommitResponse {
    fn from(value: SpecFileCommit) -> Self {
        Self {
            sha: value.commit.as_str().to_string(),
            committed_at: value.committed_at.to_rfc3339(),
            message: value.message,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecFileCommitHistoryResponse {
    items: Vec<SpecFileCommitResponse>,
    truncated: bool,
}

impl From<SpecFileHistory> for SpecFileCommitHistoryResponse {
    fn from(value: SpecFileHistory) -> Self {
        Self {
            items: value.items.into_iter().map(Into::into).collect(),
            truncated: value.truncated,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedSpecFileResponse {
    spec_id: String,
    file_key: String,
    target_path: String,
    old_path: Option<String>,
    new_path: Option<String>,
    change: FileChangeKindResponseToken,
}

impl From<ChangedSpecFile> for ChangedSpecFileResponse {
    fn from(value: ChangedSpecFile) -> Self {
        Self {
            spec_id: value.spec_id.as_str().to_string(),
            file_key: value.file_key.as_str().to_string(),
            target_path: value.target_path.as_str().to_string(),
            old_path: value.old_path.map(|path| path.as_str().to_string()),
            new_path: value.new_path.map(|path| path.as_str().to_string()),
            change: value.change.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffReviewIdentityResponse {
    repository_id: String,
    worktree_id: String,
    base_sha: String,
    current_snapshot_id: String,
}

impl From<&DiffReviewIdentity> for DiffReviewIdentityResponse {
    fn from(value: &DiffReviewIdentity) -> Self {
        Self {
            repository_id: value.repository_id().as_str().to_string(),
            worktree_id: value.worktree_id().as_str().to_string(),
            base_sha: value.base_sha().as_str().to_string(),
            current_snapshot_id: value.current_snapshot_id().as_str().to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedSpecFilesResponse {
    diff_review_identity: DiffReviewIdentityResponse,
    resolved_base_sha: String,
    current_snapshot_id: String,
    files: Vec<ChangedSpecFileResponse>,
}

impl From<ChangedSpecFiles> for ChangedSpecFilesResponse {
    fn from(value: ChangedSpecFiles) -> Self {
        Self {
            diff_review_identity: (&value.diff_review_identity).into(),
            resolved_base_sha: value.resolved_base_sha.as_str().to_string(),
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
    RevisionNotFound,
    RevisionNotCommit,
    InvalidHistoryOutput,
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
            RepositoryPortError::IdentityMismatch => Self::WorktreeUnavailable,
            RepositoryPortError::CommonDirBoundaryEscape => Self::CommonDirBoundaryEscape,
            RepositoryPortError::GitUnavailable => Self::GitUnavailable,
            RepositoryPortError::GitTimedOut { .. } => Self::GitTimedOut,
            RepositoryPortError::GitOutputLimitExceeded { .. } => Self::GitOutputLimitExceeded,
            RepositoryPortError::GitFailed { .. } => Self::GitFailed,
            RepositoryPortError::UnsupportedPathEncoding => Self::UnsupportedPathEncoding,
            RepositoryPortError::RevisionNotFound => Self::RevisionNotFound,
            RepositoryPortError::RevisionNotCommit => Self::RevisionNotCommit,
            RepositoryPortError::InvalidHistoryOutput => Self::InvalidHistoryOutput,
            RepositoryPortError::InvalidRepositoryPath => Self::InvalidRepositoryPath,
            RepositoryPortError::StaleBase => Self::StaleBase,
            RepositoryPortError::StaleSnapshot
            | RepositoryPortError::StaleCursor
            | RepositoryPortError::InvalidCursor => Self::StaleSnapshot,
            RepositoryPortError::EntryChangedDuringRead => Self::EntryChangedDuringRead,
            RepositoryPortError::Cancelled => Self::EntryChangedDuringRead,
            RepositoryPortError::ContentTooLarge => Self::GitOutputLimitExceeded,
            RepositoryPortError::PermissionDenied => Self::PermissionDenied,
            RepositoryPortError::Io => Self::Io,
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
        .list_changed_spec_files(
            &request.workspace_path,
            request
                .comparison
                .unwrap_or(ComparisonRevisionRequest::Head)
                .into_domain()?,
        )
        .map(Into::into)
        .map_err(Into::into)
}

#[tauri::command]
pub fn list_spec_diff_revisions(
    state: State<'_, CommandState>,
    request: ListSpecDiffRevisionsRequest,
) -> Result<RevisionOptionsResponse, SpecDiffCommandError> {
    state
        .spec_diff_use_cases()
        .list_spec_diff_revisions(&request.workspace_path)
        .map(|options| RevisionOptionsResponse {
            options: options.into_iter().map(Into::into).collect(),
        })
        .map_err(Into::into)
}

#[tauri::command]
pub fn list_spec_file_commit_history(
    state: State<'_, CommandState>,
    request: ListSpecFileCommitHistoryRequest,
) -> Result<SpecFileCommitHistoryResponse, SpecDiffCommandError> {
    state
        .spec_diff_use_cases()
        .list_spec_file_commit_history(
            &request.workspace_path,
            &request.spec_id,
            &request.file_key,
            &request.path,
        )
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
            request.resolved_base_sha.as_deref(),
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

    use crate::domain::repository::FileChangeKind;
    use chrono::DateTime;

    #[test]
    fn file_history_response_preserves_timestamp_offset_wire_contract() {
        let response = SpecFileCommitResponse::from(SpecFileCommit {
            commit: CommitSha::parse("a".repeat(40)).unwrap(),
            committed_at: DateTime::parse_from_rfc3339("2026-08-23T12:34:56+09:30").unwrap(),
            message: "typed timestamp".into(),
        });

        assert_eq!(
            serde_json::to_value(response).unwrap(),
            serde_json::json!({
                "sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "committedAt": "2026-08-23T12:34:56+09:30",
                "message": "typed timestamp"
            })
        );
    }

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
    fn overview_request_defaults_to_head_and_accepts_canonical_tagged_comparison() {
        let legacy: ListChangedSpecFilesRequest = serde_json::from_value(serde_json::json!({
            "workspacePath": "/repo"
        }))
        .unwrap();
        assert_eq!(legacy.comparison, None);

        let explicit: ListChangedSpecFilesRequest = serde_json::from_value(serde_json::json!({
            "workspacePath": "/repo",
            "comparison": {
                "kind": "localBranch",
                "name": "refs/heads/previous"
            }
        }))
        .unwrap();
        assert!(matches!(
            explicit.comparison.unwrap().into_domain().unwrap(),
            ComparisonRevision::LocalBranch(reference)
                if reference.as_str() == "refs/heads/previous"
        ));
    }

    #[test]
    fn comparison_request_rejects_short_ref_and_malformed_sha() {
        for request in [
            ComparisonRevisionRequest::LocalBranch {
                name: "main".into(),
            },
            ComparisonRevisionRequest::Commit { sha: "bad".into() },
        ] {
            assert_eq!(
                request.into_domain().unwrap_err().code,
                SpecDiffCommandErrorCode::InvalidInput
            );
        }
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
                SpecDiffCommandErrorCode::RevisionNotFound,
                "revisionNotFound",
            ),
            (
                SpecDiffCommandErrorCode::RevisionNotCommit,
                "revisionNotCommit",
            ),
            (
                SpecDiffCommandErrorCode::InvalidHistoryOutput,
                "invalidHistoryOutput",
            ),
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
    fn invalid_timestamp_preserves_history_error_wire_contract() {
        let error: SpecDiffCommandError =
            SpecDiffUseCaseError::<SpecDiffTargetResolutionError>::Repository(
                RepositoryPortError::InvalidHistoryOutput,
            )
            .into();

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            serde_json::json!({
                "code": "invalidHistoryOutput",
                "message": "invalid Git history output"
            })
        );
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
        assert_eq!(json["change"], "renamed");
        let _: super::super::repository::FileChangeKindResponseToken =
            FileChangeKind::Renamed.into();
    }

    #[test]
    fn changed_files_response_exposes_diff_review_identity() {
        let resolved_base_sha = CommitSha::parse("a".repeat(40)).unwrap();
        let current_snapshot_id =
            crate::domain::repository::SnapshotId::parse(format!("rs1_{}", "b".repeat(64)))
                .unwrap();
        let identity = DiffReviewIdentity::new(
            crate::domain::repository::RepositoryId::parse(format!("rr1_{}", "c".repeat(64)))
                .unwrap(),
            crate::domain::comment::diff::WorktreeStorageId::parse(format!(
                "rw1_{}",
                "d".repeat(64)
            ))
            .unwrap(),
            resolved_base_sha.clone(),
            current_snapshot_id.clone(),
        );
        let response = ChangedSpecFilesResponse::from(ChangedSpecFiles {
            diff_review_identity: identity,
            resolved_base_sha,
            current_snapshot_id,
            files: vec![],
        });

        let json = serde_json::to_value(response).unwrap();
        assert_eq!(
            json["diffReviewIdentity"]["repositoryId"],
            format!("rr1_{}", "c".repeat(64))
        );
    }
    #[test]
    fn unborn_head_maps_to_typed_command_error() {
        let error = SpecDiffCommandError::from(SpecDiffUseCaseError::Repository(
            RepositoryPortError::UnbornHead,
        ));
        assert_eq!(error.code, SpecDiffCommandErrorCode::UnbornHead);
    }
}
