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
            CancellationToken, DiffAnchorPaths, DiffAnchorResolution, DiffAnchorTarget,
            DiffCommentRevision, DiffReviewIdentity, DiffSide, ResolutionWarningCode,
            ResolvedDiffComment, ResolvedDiffComments, StaleAnchorReason, UnavailableReason,
            WorktreeStorageId,
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
        let paths = DiffAnchorPaths::new(
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
        )
        .map_err(invalid)?;
        DiffAnchorTarget::new_range(
            paths,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffSideResponseToken {
    Base,
    Current,
}

impl From<DiffSide> for DiffSideResponseToken {
    fn from(value: DiffSide) -> Self {
        match value {
            DiffSide::Base => Self::Base,
            DiffSide::Current => Self::Current,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum StaleAnchorReasonResponseToken {
    SnapshotChanged,
    PathMissing,
    AmbiguousRename,
    ContextNotFound,
    AmbiguousContext,
    Deleted,
    Binary,
    Unsupported,
}

impl From<StaleAnchorReason> for StaleAnchorReasonResponseToken {
    fn from(value: StaleAnchorReason) -> Self {
        match value {
            StaleAnchorReason::SnapshotChanged => Self::SnapshotChanged,
            StaleAnchorReason::PathMissing => Self::PathMissing,
            StaleAnchorReason::AmbiguousRename => Self::AmbiguousRename,
            StaleAnchorReason::ContextNotFound => Self::ContextNotFound,
            StaleAnchorReason::AmbiguousContext => Self::AmbiguousContext,
            StaleAnchorReason::Deleted => Self::Deleted,
            StaleAnchorReason::Binary => Self::Binary,
            StaleAnchorReason::Unsupported => Self::Unsupported,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UnavailableReasonResponseToken {
    Io,
    Permission,
    BudgetExceeded,
    Cancelled,
    RepositoryChanged,
}

impl From<UnavailableReason> for UnavailableReasonResponseToken {
    fn from(value: UnavailableReason) -> Self {
        match value {
            UnavailableReason::Io => Self::Io,
            UnavailableReason::Permission => Self::Permission,
            UnavailableReason::BudgetExceeded => Self::BudgetExceeded,
            UnavailableReason::Cancelled => Self::Cancelled,
            UnavailableReason::RepositoryChanged => Self::RepositoryChanged,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolutionWarningCodeResponseToken {
    ResolutionUnavailable(UnavailableReasonResponseToken),
    DurabilityUncertain,
}

impl From<ResolutionWarningCode> for ResolutionWarningCodeResponseToken {
    fn from(value: ResolutionWarningCode) -> Self {
        match value {
            ResolutionWarningCode::ResolutionUnavailable(reason) => {
                Self::ResolutionUnavailable(reason.into())
            }
            ResolutionWarningCode::DurabilityUncertain => Self::DurabilityUncertain,
        }
    }
}

impl Serialize for ResolutionWarningCodeResponseToken {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            Self::ResolutionUnavailable(reason) => reason.serialize(serializer),
            Self::DurabilityUncertain => serializer.serialize_str("durabilityUncertain"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffCommentDurabilityResponseToken {
    Durable,
    Uncertain,
}

impl DiffCommentDurabilityResponseToken {
    fn from_uncertainty(is_uncertain: bool) -> Self {
        if is_uncertain {
            Self::Uncertain
        } else {
            Self::Durable
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PreCommitFailureCodeResponseToken {
    RevisionOverflow,
    StoreBusy,
    Io,
    Permission,
    InvalidStore,
}

impl From<PreCommitFailureCode> for PreCommitFailureCodeResponseToken {
    fn from(value: PreCommitFailureCode) -> Self {
        match value {
            PreCommitFailureCode::RevisionOverflow => Self::RevisionOverflow,
            PreCommitFailureCode::StoreBusy => Self::StoreBusy,
            PreCommitFailureCode::Io => Self::Io,
            PreCommitFailureCode::Permission => Self::Permission,
            PreCommitFailureCode::InvalidStore => Self::InvalidStore,
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
    side: DiffSideResponseToken,
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
        side: DiffSideResponseToken,
        line: u32,
    },
    Relocated {
        selection_path: String,
        side_path: String,
        side: DiffSideResponseToken,
        line: u32,
    },
    Stale {
        reason: StaleAnchorReasonResponseToken,
        candidate_count: u32,
    },
    Unavailable {
        reason: UnavailableReasonResponseToken,
        can_jump: bool,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolutionWarningResponse {
    code: ResolutionWarningCodeResponseToken,
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
        durability: DiffCommentDurabilityResponseToken,
    },
    Conflict {
        latest_document: ResolvedDiffCommentsResponse,
        latest_revision: String,
        resolution_warnings: Vec<ResolutionWarningResponse>,
    },
    PreCommitFailure {
        code: PreCommitFailureCodeResponseToken,
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
                side: target.side().into(),
                old_path: target.old_path().map(|path| path.as_str().into()),
                new_path: target.new_path().map(|path| path.as_str().into()),
                line: target.line().get(),
                end_line: target.end_line().map(NonZeroU32::get),
                line_hash: anchor.line_hash().as_str().into(),
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
                side: (*anchor_side).into(),
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
                side: (*anchor_side).into(),
                line: line.get(),
            },
            DiffAnchorResolution::Stale {
                reason,
                candidate_count,
            } => Self::Stale {
                reason: (*reason).into(),
                candidate_count: *candidate_count,
            },
            DiffAnchorResolution::Unavailable { reason } => Self::Unavailable {
                reason: (*reason).into(),
                can_jump: false,
            },
        }
    }
}

impl From<&crate::domain::comment::diff::ResolutionWarning> for ResolutionWarningResponse {
    fn from(value: &crate::domain::comment::diff::ResolutionWarning) -> Self {
        Self {
            code: value.code.into(),
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
                    durability: DiffCommentDurabilityResponseToken::from_uncertainty(
                        durability_uncertain,
                    ),
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
                    code: code.into(),
                    retryable: code.retryable(),
                    current_document: current_document.map(Into::into),
                    current_revision,
                }
            }
        }
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
    fn target_request_preserves_wire_shape_and_rejects_invalid_side_paths() {
        let valid: DiffAnchorTargetRequest = serde_json::from_value(serde_json::json!({
            "side": "current",
            "oldPath": "src/old.rs",
            "newPath": "src/new.rs",
            "line": 4,
            "endLine": 7
        }))
        .unwrap();
        let target = DiffAnchorTarget::try_from(valid).unwrap();
        assert_eq!(target.side(), DiffSide::Current);
        assert_eq!(target.old_path().unwrap().as_str(), "src/old.rs");
        assert_eq!(target.new_path().unwrap().as_str(), "src/new.rs");
        assert_eq!(target.line().get(), 4);
        assert_eq!(target.end_line().unwrap().get(), 7);

        let invalid: DiffAnchorTargetRequest = serde_json::from_value(serde_json::json!({
            "side": "base",
            "oldPath": null,
            "newPath": "src/new.rs",
            "line": 1
        }))
        .unwrap();
        let error = DiffAnchorTarget::try_from(invalid).unwrap_err();
        assert_eq!(error.code, "invalidRequest");
        assert_eq!(error.message, "The Diff comment request is invalid.");
    }

    #[test]
    fn anchor_response_preserves_existing_wire_fields() {
        let identity = DiffReviewIdentity::try_from(identity_request()).unwrap();
        let new_path = RepositoryRelativePath::parse("src/lib.rs").unwrap();
        let target = DiffAnchorTarget::new(
            DiffAnchorPaths::Current {
                new_path: new_path.clone(),
                old_path: None,
            },
            NonZeroU32::new(2).unwrap(),
        );
        let line_hash = crate::domain::comment::diff::line_hash("line");
        let expected_line_hash = line_hash.as_str().to_owned();
        let anchor = crate::domain::comment::diff::DiffLineAnchor::new(
            identity,
            target,
            line_hash,
            "line".into(),
            vec!["before".into()],
            vec!["after".into()],
        )
        .unwrap();
        let comment = crate::domain::comment::diff::StoredDiffComment::new(
            "c1".into(),
            "body".into(),
            false,
            chrono::Utc::now(),
            anchor,
        )
        .unwrap();
        let resolved = ResolvedDiffComment {
            comment,
            anchor_resolution: DiffAnchorResolution::Exact {
                selection_path: new_path.clone(),
                side_path: new_path,
                side: DiffSide::Current,
                line: NonZeroU32::new(2).unwrap(),
            },
        };

        let value = serde_json::to_value(ResolvedDiffCommentResponse::from(&resolved)).unwrap();
        let anchor = &value["anchor"];
        assert_eq!(anchor["side"], "current");
        assert_eq!(anchor["newPath"], "src/lib.rs");
        assert!(anchor.get("oldPath").is_none());
        assert_eq!(anchor["line"], 2);
        assert_eq!(anchor["lineHash"], expected_line_hash);
        assert_eq!(anchor["snippet"], "line");
        assert_eq!(anchor["contextBefore"], serde_json::json!(["before"]));
        assert_eq!(anchor["contextAfter"], serde_json::json!(["after"]));
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

    #[test]
    fn update_request_wire_remains_flat_and_deleted_defaults_to_false() {
        let request: UpdateDiffCommentRequest = serde_json::from_value(serde_json::json!({
            "identity": {
                "repositoryId": format!("rr1_{}", "1".repeat(64)),
                "worktreeId": format!("rw1_{}", "2".repeat(64)),
                "baseSha": "3".repeat(40),
                "currentSnapshotId": format!("rs1_{}", "4".repeat(64))
            },
            "expectedRevision": "0",
            "commentId": "c1",
            "body": "updated",
            "resolved": true,
            "replyBody": null
        }))
        .unwrap();

        assert_eq!(request.comment_id, "c1");
        assert_eq!(request.body.as_deref(), Some("updated"));
        assert_eq!(request.resolved, Some(true));
        assert_eq!(request.reply_body, None);
        assert!(!request.deleted);
    }

    #[test]
    fn update_request_wire_rejects_top_level_intent_field() {
        let error = serde_json::from_value::<UpdateDiffCommentRequest>(serde_json::json!({
            "identity": {
                "repositoryId": format!("rr1_{}", "1".repeat(64)),
                "worktreeId": format!("rw1_{}", "2".repeat(64)),
                "baseSha": "3".repeat(40),
                "currentSnapshotId": format!("rs1_{}", "4".repeat(64))
            },
            "expectedRevision": "0",
            "commentId": "c1",
            "body": "updated",
            "resolved": null,
            "replyBody": null,
            "deleted": false,
            "intent": {
                "kind": "edit"
            }
        }))
        .unwrap_err();

        assert!(error.to_string().contains("unknown field `intent`"));
    }

    #[test]
    fn update_request_converts_each_valid_mutation_intent_with_exact_payload() {
        let body_only = UpdateDiffCommentCommandInput::try_from(update_request(
            Some("body only"),
            None,
            None,
            false,
        ))
        .unwrap();
        let DiffCommentUpdate::Edit {
            comment_id,
            body,
            resolved,
        } = body_only.intent
        else {
            panic!("body-only request must become Edit");
        };
        assert_eq!(comment_id, "c1");
        assert_eq!(body.as_deref(), Some("body only"));
        assert_eq!(resolved, None);

        let resolution_only =
            UpdateDiffCommentCommandInput::try_from(update_request(None, Some(false), None, false))
                .unwrap();
        let DiffCommentUpdate::Edit {
            comment_id,
            body,
            resolved,
        } = resolution_only.intent
        else {
            panic!("resolution-only request must become Edit");
        };
        assert_eq!(comment_id, "c1");
        assert_eq!(body, None);
        assert_eq!(resolved, Some(false));

        let body_and_resolution = UpdateDiffCommentCommandInput::try_from(update_request(
            Some("body and resolution"),
            Some(true),
            None,
            false,
        ))
        .unwrap();
        let DiffCommentUpdate::Edit {
            comment_id,
            body,
            resolved,
        } = body_and_resolution.intent
        else {
            panic!("body-and-resolution request must become Edit");
        };
        assert_eq!(comment_id, "c1");
        assert_eq!(body.as_deref(), Some("body and resolution"));
        assert_eq!(resolved, Some(true));

        let reply = UpdateDiffCommentCommandInput::try_from(update_request(
            None,
            None,
            Some("follow up"),
            false,
        ))
        .unwrap();
        let DiffCommentUpdate::Reply { comment_id, body } = reply.intent else {
            panic!("reply request must become Reply");
        };
        assert_eq!(comment_id, "c1");
        assert_eq!(body, "follow up");

        let delete =
            UpdateDiffCommentCommandInput::try_from(update_request(None, None, None, true))
                .unwrap();
        let DiffCommentUpdate::Delete { comment_id } = delete.intent else {
            panic!("delete request must become Delete");
        };
        assert_eq!(comment_id, "c1");
    }

    #[test]
    fn update_request_rejects_every_invalid_mutation_combination_with_stable_wire_error() {
        let invalid_requests = [
            update_request(None, None, None, false),
            update_request(Some("body"), None, Some("reply"), false),
            update_request(None, Some(true), Some("reply"), false),
            update_request(Some("body"), Some(true), Some("reply"), false),
            update_request(Some("body"), None, None, true),
            update_request(None, Some(true), None, true),
            update_request(None, None, Some("reply"), true),
            update_request(Some("body"), Some(true), None, true),
            update_request(Some("body"), None, Some("reply"), true),
            update_request(None, Some(true), Some("reply"), true),
            update_request(Some("body"), Some(true), Some("reply"), true),
        ];

        for request in invalid_requests {
            let error = UpdateDiffCommentCommandInput::try_from(request).unwrap_err();
            assert_eq!(error.code, "invalidRequest");
            assert_eq!(error.message, "The Diff comment request is invalid.");
        }
    }

    #[test]
    fn update_request_validates_identity_then_revision_before_intent() {
        let mut invalid_identity = update_request(Some("updated"), None, None, false);
        invalid_identity.identity.repository_id = "invalid".into();
        invalid_identity.expected_revision = "invalid".into();
        let identity_error = UpdateDiffCommentCommandInput::try_from(invalid_identity).unwrap_err();
        assert_eq!(identity_error.code, "invalidRequest");
        assert_eq!(
            identity_error.message,
            "The Diff comment request is invalid."
        );

        let mut invalid_revision = update_request(None, None, None, false);
        invalid_revision.expected_revision = "invalid".into();
        let revision_error = UpdateDiffCommentCommandInput::try_from(invalid_revision).unwrap_err();
        assert_eq!(revision_error.code, "invalidRevision");
        assert_eq!(
            revision_error.message,
            "The Diff comment revision is invalid."
        );
    }
}
