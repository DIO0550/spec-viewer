//! Tauri DTOs and handlers for repository Diff comments.

use std::num::NonZeroU32;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app::use_cases::diff_comments::{
        DiffCommentMutationOutcome, DiffCommentUpdate, DiffCommentUseCaseError,
        PreCommitFailureCode,
    },
    domain::{
        comment::diff::{
            CancellationToken, DiffAnchorResolution, DiffAnchorTarget, DiffCommentRevision,
            DiffReviewIdentity, DiffSide, ResolutionWarningCode, ResolvedDiffComment,
            ResolvedDiffComments, StaleAnchorReason, UnavailableReason, WorktreeStorageId,
        },
        repository::{CommitSha, RepositoryId, RepositoryRelativePath, SnapshotId},
    },
};

use super::CommandState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiffReviewIdentityRequest {
    repository_id: String,
    worktree_id: String,
    base_sha: String,
    current_snapshot_id: String,
}

impl TryFrom<DiffReviewIdentityRequest> for DiffReviewIdentity {
    type Error = DiffCommentCommandError;
    fn try_from(value: DiffReviewIdentityRequest) -> Result<Self, Self::Error> {
        Ok(Self::new(
            RepositoryId::parse(value.repository_id).map_err(invalid)?,
            WorktreeStorageId::parse(value.worktree_id).map_err(invalid)?,
            CommitSha::parse(value.base_sha).map_err(invalid)?,
            SnapshotId::parse(value.current_snapshot_id).map_err(invalid)?,
        ))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LoadDiffCommentsRequest {
    identity: DiffReviewIdentityRequest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveDiffCommentRequest {
    identity: DiffReviewIdentityRequest,
    expected_revision: String,
    target: DiffAnchorTargetRequest,
    body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateDiffCommentRequest {
    identity: DiffReviewIdentityRequest,
    expected_revision: String,
    comment_id: String,
    body: Option<String>,
    resolved: Option<bool>,
    reply_body: Option<String>,
    #[serde(default)]
    deleted: bool,
}

#[derive(Debug)]
struct UpdateDiffCommentCommandInput {
    identity: DiffReviewIdentity,
    expected_revision: DiffCommentRevision,
    intent: DiffCommentUpdate,
}

impl TryFrom<UpdateDiffCommentRequest> for UpdateDiffCommentCommandInput {
    type Error = DiffCommentCommandError;

    fn try_from(value: UpdateDiffCommentRequest) -> Result<Self, Self::Error> {
        let UpdateDiffCommentRequest {
            identity,
            expected_revision,
            comment_id,
            body,
            resolved,
            reply_body,
            deleted,
        } = value;
        let identity = DiffReviewIdentity::try_from(identity)?;
        let expected_revision = expected_revision
            .parse::<DiffCommentRevision>()
            .map_err(invalid_revision)?;
        let intent = match (deleted, body, resolved, reply_body) {
            (true, None, None, None) => DiffCommentUpdate::Delete { comment_id },
            (false, body, resolved, None) if body.is_some() || resolved.is_some() => {
                DiffCommentUpdate::Edit {
                    comment_id,
                    body,
                    resolved,
                }
            }
            (false, None, None, Some(body)) => DiffCommentUpdate::Reply { comment_id, body },
            _ => return Err(DiffCommentCommandError::invalid("update")),
        };

        Ok(Self {
            identity,
            expected_revision,
            intent,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiffAnchorTargetRequest {
    side: DiffSideRequest,
    old_path: Option<String>,
    new_path: Option<String>,
    line: u32,
    #[serde(default)]
    end_line: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
enum DiffSideRequest {
    Base,
    Current,
}

impl TryFrom<DiffAnchorTargetRequest> for DiffAnchorTarget {
    type Error = DiffCommentCommandError;
    fn try_from(value: DiffAnchorTargetRequest) -> Result<Self, Self::Error> {
        DiffAnchorTarget::new_range(
            match value.side {
                DiffSideRequest::Base => DiffSide::Base,
                DiffSideRequest::Current => DiffSide::Current,
            },
            value
                .old_path
                .map(RepositoryRelativePath::parse)
                .transpose()
                .map_err(invalid)?,
            value
                .new_path
                .map(RepositoryRelativePath::parse)
                .transpose()
                .map_err(invalid)?,
            NonZeroU32::new(value.line).ok_or_else(|| DiffCommentCommandError::invalid("line"))?,
            value
                .end_line
                .map(|line| {
                    NonZeroU32::new(line).ok_or_else(|| DiffCommentCommandError::invalid("endLine"))
                })
                .transpose()?,
        )
        .map_err(invalid)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffCommentCommandError {
    code: &'static str,
    message: &'static str,
}

impl DiffCommentCommandError {
    fn invalid(_field: &'static str) -> Self {
        Self {
            code: "invalidRequest",
            message: "The Diff comment request is invalid.",
        }
    }
}

fn invalid<T: std::fmt::Display>(_error: T) -> DiffCommentCommandError {
    DiffCommentCommandError::invalid("value")
}
fn invalid_revision<T: std::fmt::Display>(_error: T) -> DiffCommentCommandError {
    DiffCommentCommandError {
        code: "invalidRevision",
        message: "The Diff comment revision is invalid.",
    }
}

impl From<DiffCommentUseCaseError> for DiffCommentCommandError {
    fn from(error: DiffCommentUseCaseError) -> Self {
        match error {
            DiffCommentUseCaseError::InvalidRequest(_) => Self::invalid("request"),
            DiffCommentUseCaseError::LineAlreadyCommented => Self {
                code: "lineAlreadyCommented",
                message: "This repository line already has a comment.",
            },
            DiffCommentUseCaseError::IdentityUnavailable => Self {
                code: "identityMismatch",
                message: "The repository review identity is unavailable.",
            },
            DiffCommentUseCaseError::Repository(error) => Self {
                code: match error {
                    crate::domain::repository::RepositoryPortError::StaleSnapshot
                    | crate::domain::repository::RepositoryPortError::EntryChangedDuringRead
                    | crate::domain::repository::RepositoryPortError::HeadChangedDuringRead => {
                        "staleSnapshot"
                    }
                    crate::domain::repository::RepositoryPortError::StaleBase => "staleBase",
                    crate::domain::repository::RepositoryPortError::WorktreeUnavailable
                    | crate::domain::repository::RepositoryPortError::CommonDirBoundaryEscape
                    | crate::domain::repository::RepositoryPortError::IdentityMismatch => {
                            "identityMismatch"
                        }
                    crate::domain::repository::RepositoryPortError::InvalidRepositoryPath => {
                        "pathBoundary"
                    }
                    _ => "unavailable",
                },
                message: "The repository could not be read.",
            },
            DiffCommentUseCaseError::Store(error) => Self {
                code: if matches!(
                    error,
                    crate::domain::comment::diff_repository::DiffCommentRepositoryError::InvalidStore
                ) {
                    "schema"
                } else {
                    "unavailable"
                },
                message: "The Diff comment store could not be read.",
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedDiffCommentsResponse {
    version: u8,
    repository_id: String,
    worktree_id: String,
    revision: String,
    comments: Vec<ResolvedDiffCommentResponse>,
    resolution_warnings: Vec<ResolutionWarningResponse>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedDiffCommentResponse {
    id: String,
    body: String,
    resolved: bool,
    created_at: String,
    replies: Vec<DiffCommentReplyResponse>,
    anchor: DiffLineAnchorResponse,
    anchor_resolution: DiffAnchorResolutionResponse,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffCommentReplyResponse {
    id: String,
    body: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineAnchorResponse {
    repository_id: String,
    worktree_id: String,
    base_sha: String,
    current_snapshot_id: String,
    side: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    old_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    new_path: Option<String>,
    line: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    end_line: Option<u32>,
    line_hash: String,
    snippet: String,
    context_before: Vec<String>,
    context_after: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum DiffAnchorResolutionResponse {
    Exact {
        selection_path: String,
        side_path: String,
        side: &'static str,
        line: u32,
    },
    Relocated {
        selection_path: String,
        side_path: String,
        side: &'static str,
        line: u32,
    },
    Stale {
        reason: &'static str,
        candidate_count: u32,
    },
    Unavailable {
        reason: &'static str,
        can_jump: bool,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolutionWarningResponse {
    code: &'static str,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum DiffCommentMutationOutcomeResponse {
    Committed {
        document: ResolvedDiffCommentsResponse,
        revision: String,
        resolution_warnings: Vec<ResolutionWarningResponse>,
        durability: &'static str,
    },
    Conflict {
        latest_document: ResolvedDiffCommentsResponse,
        latest_revision: String,
        resolution_warnings: Vec<ResolutionWarningResponse>,
    },
    PreCommitFailure {
        code: &'static str,
        retryable: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        current_document: Option<ResolvedDiffCommentsResponse>,
        #[serde(skip_serializing_if = "Option::is_none")]
        current_revision: Option<String>,
    },
}

impl From<ResolvedDiffComments> for ResolvedDiffCommentsResponse {
    fn from(value: ResolvedDiffComments) -> Self {
        let scope = value.document.scope();
        let response = Self {
            version: 1,
            repository_id: scope.repository_id().as_str().into(),
            worktree_id: scope.worktree_id().as_str().into(),
            revision: value.document.revision().to_string(),
            comments: value
                .comments
                .iter()
                .map(ResolvedDiffCommentResponse::from)
                .collect(),
            resolution_warnings: value
                .resolution_warnings
                .iter()
                .map(ResolutionWarningResponse::from)
                .collect(),
        };
        response
    }
}

impl From<&ResolvedDiffComment> for ResolvedDiffCommentResponse {
    fn from(value: &ResolvedDiffComment) -> Self {
        let comment = &value.comment;
        let anchor = comment.anchor();
        let target = anchor.target();
        Self {
            id: comment.id().into(),
            body: comment.body().into(),
            resolved: comment.resolved(),
            created_at: comment.created_at().to_rfc3339(),
            replies: comment
                .replies()
                .iter()
                .map(|reply| DiffCommentReplyResponse {
                    id: reply.id().into(),
                    body: reply.body().into(),
                    created_at: reply.created_at().to_rfc3339(),
                })
                .collect(),
            anchor: DiffLineAnchorResponse {
                repository_id: anchor.identity().repository_id().as_str().into(),
                worktree_id: anchor.identity().worktree_id().as_str().into(),
                base_sha: anchor.identity().base_sha().as_str().into(),
                current_snapshot_id: anchor.identity().current_snapshot_id().as_str().into(),
                side: side(target.side()),
                old_path: target.old_path().map(|path| path.as_str().into()),
                new_path: target.new_path().map(|path| path.as_str().into()),
                line: target.line().get(),
                end_line: target.end_line().map(NonZeroU32::get),
                line_hash: anchor.line_hash().into(),
                snippet: anchor.snippet().into(),
                context_before: anchor.context_before().to_vec(),
                context_after: anchor.context_after().to_vec(),
            },
            anchor_resolution: (&value.anchor_resolution).into(),
        }
    }
}

impl From<&DiffAnchorResolution> for DiffAnchorResolutionResponse {
    fn from(value: &DiffAnchorResolution) -> Self {
        match value {
            DiffAnchorResolution::Exact {
                selection_path,
                side_path,
                side: anchor_side,
                line,
            } => Self::Exact {
                selection_path: selection_path.as_str().into(),
                side_path: side_path.as_str().into(),
                side: side(*anchor_side),
                line: line.get(),
            },
            DiffAnchorResolution::Relocated {
                selection_path,
                side_path,
                side: anchor_side,
                line,
            } => Self::Relocated {
                selection_path: selection_path.as_str().into(),
                side_path: side_path.as_str().into(),
                side: side(*anchor_side),
                line: line.get(),
            },
            DiffAnchorResolution::Stale {
                reason,
                candidate_count,
            } => Self::Stale {
                reason: stale_reason(*reason),
                candidate_count: *candidate_count,
            },
            DiffAnchorResolution::Unavailable { reason } => Self::Unavailable {
                reason: unavailable_reason(*reason),
                can_jump: false,
            },
        }
    }
}

impl From<&crate::domain::comment::diff::ResolutionWarning> for ResolutionWarningResponse {
    fn from(value: &crate::domain::comment::diff::ResolutionWarning) -> Self {
        Self {
            code: match value.code {
                ResolutionWarningCode::ResolutionUnavailable(reason) => unavailable_reason(reason),
                ResolutionWarningCode::DurabilityUncertain => "durabilityUncertain",
            },
            message: value.message.clone(),
        }
    }
}

impl From<DiffCommentMutationOutcome> for DiffCommentMutationOutcomeResponse {
    fn from(value: DiffCommentMutationOutcome) -> Self {
        match value {
            DiffCommentMutationOutcome::Committed {
                document,
                durability_uncertain,
            } => {
                let revision = document.document.revision().to_string();
                let resolution_warnings = document
                    .resolution_warnings
                    .iter()
                    .map(ResolutionWarningResponse::from)
                    .collect();
                Self::Committed {
                    document: document.into(),
                    revision,
                    resolution_warnings,
                    durability: if durability_uncertain {
                        "uncertain"
                    } else {
                        "durable"
                    },
                }
            }
            DiffCommentMutationOutcome::Conflict { latest_document } => {
                let latest_revision = latest_document.document.revision().to_string();
                let resolution_warnings = latest_document
                    .resolution_warnings
                    .iter()
                    .map(ResolutionWarningResponse::from)
                    .collect();
                Self::Conflict {
                    latest_document: latest_document.into(),
                    latest_revision,
                    resolution_warnings,
                }
            }
            DiffCommentMutationOutcome::PreCommitFailure {
                code,
                current_document,
            } => {
                let current_revision = current_document
                    .as_ref()
                    .map(|document| document.document.revision().to_string());
                Self::PreCommitFailure {
                    code: precommit_code(code),
                    retryable: code.retryable(),
                    current_document: current_document.map(Into::into),
                    current_revision,
                }
            }
        }
    }
}

fn side(value: DiffSide) -> &'static str {
    match value {
        DiffSide::Base => "base",
        DiffSide::Current => "current",
    }
}
fn stale_reason(value: StaleAnchorReason) -> &'static str {
    match value {
        StaleAnchorReason::SnapshotChanged => "snapshotChanged",
        StaleAnchorReason::PathMissing => "pathMissing",
        StaleAnchorReason::AmbiguousRename => "ambiguousRename",
        StaleAnchorReason::ContextNotFound => "contextNotFound",
        StaleAnchorReason::AmbiguousContext => "ambiguousContext",
        StaleAnchorReason::Deleted => "deleted",
        StaleAnchorReason::Binary => "binary",
        StaleAnchorReason::Unsupported => "unsupported",
    }
}
fn unavailable_reason(value: UnavailableReason) -> &'static str {
    match value {
        UnavailableReason::Io => "io",
        UnavailableReason::Permission => "permission",
        UnavailableReason::BudgetExceeded => "budgetExceeded",
        UnavailableReason::Cancelled => "cancelled",
        UnavailableReason::RepositoryChanged => "repositoryChanged",
    }
}
fn precommit_code(value: PreCommitFailureCode) -> &'static str {
    match value {
        PreCommitFailureCode::RevisionOverflow => "revisionOverflow",
        PreCommitFailureCode::StoreBusy => "storeBusy",
        PreCommitFailureCode::Io => "io",
        PreCommitFailureCode::Permission => "permission",
        PreCommitFailureCode::InvalidStore => "invalidStore",
    }
}

#[tauri::command]
pub fn load_diff_comments(
    state: State<'_, CommandState>,
    request: LoadDiffCommentsRequest,
) -> Result<ResolvedDiffCommentsResponse, DiffCommentCommandError> {
    let identity = DiffReviewIdentity::try_from(request.identity)?;
    let cancellation = state.begin_diff_comment_load(&identity);
    state
        .diff_comment_use_cases()
        .load(&identity, &cancellation)
        .map(Into::into)
        .map_err(Into::into)
}

#[tauri::command]
pub fn save_diff_comment(
    state: State<'_, CommandState>,
    request: SaveDiffCommentRequest,
) -> Result<DiffCommentMutationOutcomeResponse, DiffCommentCommandError> {
    let identity = DiffReviewIdentity::try_from(request.identity)?;
    let revision = request
        .expected_revision
        .parse::<DiffCommentRevision>()
        .map_err(invalid_revision)?;
    let target = DiffAnchorTarget::try_from(request.target)?;
    state
        .diff_comment_use_cases()
        .save(
            &identity,
            revision,
            target,
            request.body,
            &CancellationToken::default(),
        )
        .map(Into::into)
        .map_err(Into::into)
}

#[tauri::command]
pub fn update_diff_comment(
    state: State<'_, CommandState>,
    request: UpdateDiffCommentRequest,
) -> Result<DiffCommentMutationOutcomeResponse, DiffCommentCommandError> {
    let UpdateDiffCommentCommandInput {
        identity,
        expected_revision,
        intent,
    } = request.try_into()?;
    state
        .diff_comment_use_cases()
        .update(
            &identity,
            expected_revision,
            intent,
            &CancellationToken::default(),
        )
        .map(Into::into)
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity_request() -> DiffReviewIdentityRequest {
        DiffReviewIdentityRequest {
            repository_id: format!("rr1_{}", "1".repeat(64)),
            worktree_id: format!("rw1_{}", "2".repeat(64)),
            base_sha: "3".repeat(40),
            current_snapshot_id: format!("rs1_{}", "4".repeat(64)),
        }
    }

    fn update_request(
        body: Option<&str>,
        resolved: Option<bool>,
        reply_body: Option<&str>,
        deleted: bool,
    ) -> UpdateDiffCommentRequest {
        UpdateDiffCommentRequest {
            identity: identity_request(),
            expected_revision: "0".into(),
            comment_id: "c1".into(),
            body: body.map(str::to_owned),
            resolved,
            reply_body: reply_body.map(str::to_owned),
            deleted,
        }
    }

    #[test]
    fn unavailable_wire_is_non_jumpable() {
        let response = DiffAnchorResolutionResponse::from(&DiffAnchorResolution::Unavailable {
            reason: UnavailableReason::BudgetExceeded,
        });
        let value = serde_json::to_value(response).unwrap();
        assert_eq!(value["status"], "unavailable");
        assert_eq!(value["reason"], "budgetExceeded");
        assert_eq!(value["canJump"], false);
    }

    #[test]
    fn revision_overflow_wire_is_non_retryable() {
        assert_eq!(
            precommit_code(PreCommitFailureCode::RevisionOverflow),
            "revisionOverflow"
        );
        assert!(!PreCommitFailureCode::RevisionOverflow.retryable());
    }

    #[test]
    fn repository_identity_mismatch_has_stable_wire_code() {
        let error = DiffCommentCommandError::from(DiffCommentUseCaseError::Repository(
            crate::domain::repository::RepositoryPortError::IdentityMismatch,
        ));
        assert_eq!(error.code, "identityMismatch");
        assert_eq!(error.message, "The repository could not be read.");
    }
}
