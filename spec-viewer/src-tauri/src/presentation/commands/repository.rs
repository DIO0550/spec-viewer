//! Tauri DTOs for repository-wide review.
use super::CommandState;
use crate::{app::use_cases::repository_diff::RepositoryUseCaseError, domain::repository::*};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadRepositoryDiffRequest {
    pub worktree_id: String,
    pub base_override: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraverseIgnoredRequest {
    pub worktree_id: String,
    pub current_snapshot_id: String,
    pub node_id: String,
    pub cursor: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadRepositoryFileRequest {
    pub worktree_id: String,
    pub current_snapshot_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FileChangeKindResponseToken {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
    Untracked,
}

impl From<FileChangeKind> for FileChangeKindResponseToken {
    fn from(value: FileChangeKind) -> Self {
        match value {
            FileChangeKind::Added => Self::Added,
            FileChangeKind::Modified => Self::Modified,
            FileChangeKind::Deleted => Self::Deleted,
            FileChangeKind::Renamed => Self::Renamed,
            FileChangeKind::Copied => Self::Copied,
            FileChangeKind::TypeChanged => Self::TypeChanged,
            FileChangeKind::Untracked => Self::Untracked,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EntryKindResponseToken {
    Regular,
    Symlink,
    Submodule,
}

impl From<EntryKind> for EntryKindResponseToken {
    fn from(value: EntryKind) -> Self {
        match value {
            EntryKind::Regular => Self::Regular,
            EntryKind::Symlink => Self::Symlink,
            EntryKind::Submodule => Self::Submodule,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ContentClassificationResponseToken {
    Text,
    Binary,
    NotApplicable,
    Unknown,
}

impl From<ContentClassification> for ContentClassificationResponseToken {
    fn from(value: ContentClassification) -> Self {
        match value {
            ContentClassification::Text => Self::Text,
            ContentClassification::Binary => Self::Binary,
            ContentClassification::NotApplicable => Self::NotApplicable,
            ContentClassification::Unknown => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum OmissionReasonResponseToken {
    Binary,
    LargeFile,
    DiffLimit,
    MissingSide,
    UnsupportedEntryKind,
}

impl From<OmissionReason> for OmissionReasonResponseToken {
    fn from(value: OmissionReason) -> Self {
        match value {
            OmissionReason::Binary => Self::Binary,
            OmissionReason::LargeFile => Self::LargeFile,
            OmissionReason::DiffLimit => Self::DiffLimit,
            OmissionReason::MissingSide => Self::MissingSide,
            OmissionReason::UnsupportedEntryKind => Self::UnsupportedEntryKind,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineKindResponseToken {
    Context,
    Added,
    Removed,
    NoNewline,
}

impl From<DiffLineKind> for DiffLineKindResponseToken {
    fn from(value: DiffLineKind) -> Self {
        match value {
            DiffLineKind::Context => Self::Context,
            DiffLineKind::Added => Self::Added,
            DiffLineKind::Removed => Self::Removed,
            DiffLineKind::NoNewline => Self::NoNewline,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BaseResolutionReasonResponseToken {
    NotFound,
    AmbiguousRemoteHead,
    DetachedHead,
    ShallowHistory,
    UnbornHead,
    NoCommonAncestor,
    MissingRef,
    InvalidRef,
}

impl From<BaseResolutionFailure> for BaseResolutionReasonResponseToken {
    fn from(value: BaseResolutionFailure) -> Self {
        match value {
            BaseResolutionFailure::NotFound => Self::NotFound,
            BaseResolutionFailure::AmbiguousRemoteHead => Self::AmbiguousRemoteHead,
            BaseResolutionFailure::DetachedHead => Self::DetachedHead,
            BaseResolutionFailure::ShallowHistory => Self::ShallowHistory,
            BaseResolutionFailure::UnbornHead => Self::UnbornHead,
            BaseResolutionFailure::NoCommonAncestor => Self::NoCommonAncestor,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BaseResolutionSourceResponseToken {
    Explicit,
    GhMergeBase,
    CurrentRemoteHead,
    OriginHead,
    OtherRemoteHead,
    Main,
    Master,
}

impl From<BaseResolutionSource> for BaseResolutionSourceResponseToken {
    fn from(value: BaseResolutionSource) -> Self {
        match value {
            BaseResolutionSource::Explicit => Self::Explicit,
            BaseResolutionSource::GhMergeBase => Self::GhMergeBase,
            BaseResolutionSource::CurrentRemoteHead => Self::CurrentRemoteHead,
            BaseResolutionSource::OriginHead => Self::OriginHead,
            BaseResolutionSource::OtherRemoteHead => Self::OtherRemoteHead,
            BaseResolutionSource::Main => Self::Main,
            BaseResolutionSource::Master => Self::Master,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryCommandError {
    pub code: String,
    pub message: String,
}
impl RepositoryCommandError {
    pub(crate) fn port_error_code(error: &RepositoryPortError) -> &'static str {
        match error {
            RepositoryPortError::UnbornHead => "unbornHead",
            RepositoryPortError::HeadChangedDuringRead => "headChangedDuringRead",
            RepositoryPortError::NotRepository => "notRepository",
            RepositoryPortError::BareRepository => "bareRepository",
            RepositoryPortError::WorktreeUnavailable => "worktreeUnavailable",
            RepositoryPortError::IdentityMismatch => "identityMismatch",
            RepositoryPortError::CommonDirBoundaryEscape => "commonDirBoundaryEscape",
            RepositoryPortError::GitUnavailable => "gitUnavailable",
            RepositoryPortError::GitTimedOut { .. } => "gitTimedOut",
            RepositoryPortError::GitOutputLimitExceeded { .. } => "gitOutputLimitExceeded",
            RepositoryPortError::GitFailed { .. } => "gitFailed",
            RepositoryPortError::UnsupportedPathEncoding => "unsupportedPathEncoding",
            RepositoryPortError::RevisionNotFound => "revisionNotFound",
            RepositoryPortError::RevisionNotCommit => "revisionNotCommit",
            RepositoryPortError::InvalidHistoryOutput => "invalidHistoryOutput",
            RepositoryPortError::InvalidRepositoryPath => "invalidRepositoryPath",
            RepositoryPortError::StaleBase => "staleBase",
            RepositoryPortError::StaleSnapshot => "staleSnapshot",
            RepositoryPortError::StaleCursor => "staleCursor",
            RepositoryPortError::InvalidCursor => "invalidCursor",
            RepositoryPortError::EntryChangedDuringRead => "entryChangedDuringRead",
            RepositoryPortError::Cancelled => "cancelled",
            RepositoryPortError::ContentTooLarge => "contentTooLarge",
            RepositoryPortError::PermissionDenied => "permissionDenied",
            RepositoryPortError::Io => "io",
        }
    }
}
impl From<RepositoryUseCaseError> for RepositoryCommandError {
    fn from(error: RepositoryUseCaseError) -> Self {
        let code = match &error {
            RepositoryUseCaseError::InvalidInput(_)
            | RepositoryUseCaseError::InvalidRepositoryValue => "invalidInput",
            RepositoryUseCaseError::InvalidOverride { .. } => "invalidOverride",
            RepositoryUseCaseError::Port(port) => Self::port_error_code(port),
        };
        Self {
            code: code.into(),
            message: error.to_string(),
        }
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseResponse {
    pub state: &'static str,
    pub source: Option<BaseResolutionSourceResponseToken>,
    pub branch_ref: Option<String>,
    pub merge_base_sha: Option<String>,
    pub head_sha: Option<String>,
    pub reason: Option<BaseResolutionReasonResponseToken>,
    pub candidates: Vec<String>,
    pub override_ref: Option<String>,
}
impl From<&BaseBranchResolution> for BaseResponse {
    fn from(base: &BaseBranchResolution) -> Self {
        match base {
            BaseBranchResolution::Resolved {
                branch_ref,
                merge_base_sha,
                head_sha,
            } => Self {
                state: "resolved",
                source: None,
                branch_ref: Some(branch_ref.clone()),
                merge_base_sha: Some(merge_base_sha.as_str().into()),
                head_sha: Some(head_sha.as_str().into()),
                reason: None,
                candidates: vec![],
                override_ref: None,
            },
            BaseBranchResolution::NeedsSelection { reason, candidates } => Self {
                state: "needsSelection",
                source: None,
                branch_ref: None,
                merge_base_sha: None,
                head_sha: None,
                reason: Some((*reason).into()),
                candidates: candidates.clone(),
                override_ref: None,
            },
            BaseBranchResolution::InvalidOverride {
                override_ref,
                missing,
            } => Self {
                state: "invalidOverride",
                source: None,
                branch_ref: None,
                merge_base_sha: None,
                head_sha: None,
                reason: Some(if *missing {
                    BaseResolutionReasonResponseToken::MissingRef
                } else {
                    BaseResolutionReasonResponseToken::InvalidRef
                }),
                candidates: vec![],
                override_ref: Some(override_ref.clone()),
            },
        }
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeResponse {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub change: FileChangeKindResponseToken,
    pub entry_kind: EntryKindResponseToken,
    pub content_classification: ContentClassificationResponseToken,
    pub similarity: Option<u8>,
    pub old_mode: Option<String>,
    pub new_mode: Option<String>,
}
impl From<&DiffFile> for FileChangeResponse {
    fn from(file: &DiffFile) -> Self {
        Self {
            old_path: file.old_path.as_ref().map(|p| p.as_str().into()),
            new_path: file.new_path.as_ref().map(|p| p.as_str().into()),
            change: file.change.into(),
            entry_kind: file.entry_kind.into(),
            content_classification: file.content_classification.into(),
            similarity: file.similarity,
            old_mode: file.old_mode.clone(),
            new_mode: file.new_mode.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryFileChangeResponse {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub change: Option<FileChangeKindResponseToken>,
    pub entry_kind: EntryKindResponseToken,
    pub content_classification: ContentClassificationResponseToken,
    pub similarity: Option<u8>,
    pub old_mode: Option<String>,
    pub new_mode: Option<String>,
}

impl From<RepositoryFileMetadata> for RepositoryFileChangeResponse {
    fn from(file: RepositoryFileMetadata) -> Self {
        let change = file.change.map(Into::into);
        Self {
            old_path: file.old_path.map(|path| path.as_str().into()),
            new_path: file.new_path.map(|path| path.as_str().into()),
            change,
            entry_kind: file.entry_kind.into(),
            content_classification: file.content_classification.into(),
            similarity: file.similarity,
            old_mode: file.old_mode,
            new_mode: file.new_mode,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "state",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum TreeChildrenResponse {
    Loaded { items: Vec<TreeNodeResponse> },
    Deferred { node_id: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNodeResponse {
    pub path: String,
    pub name: String,
    pub kind: &'static str,
    pub entry_kind: Option<EntryKindResponseToken>,
    pub change: Option<FileChangeKindResponseToken>,
    pub ignored: bool,
    pub children: TreeChildrenResponse,
}
impl From<TreeNode> for TreeNodeResponse {
    fn from(node: TreeNode) -> Self {
        Self {
            path: node.path.as_str().into(),
            name: node.name,
            kind: match node.kind {
                TreeNodeKind::File => "file",
                TreeNodeKind::Directory => "directory",
            },
            entry_kind: node.entry_kind.map(Into::into),
            change: node.change.map(Into::into),
            ignored: node.ignored,
            children: match node.children {
                TreeChildren::Loaded(items) => TreeChildrenResponse::Loaded {
                    items: items.into_iter().map(Into::into).collect(),
                },
                TreeChildren::Deferred { node_id } => TreeChildrenResponse::Deferred { node_id },
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffReviewIdentityResponse {
    pub repository_id: String,
    pub worktree_id: String,
    pub base_sha: String,
    pub current_snapshot_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryOverviewResponse {
    pub repository_id: Option<String>,
    pub base: BaseResponse,
    pub diff_review_identity: Option<DiffReviewIdentityResponse>,
    pub display_worktree_label: Option<String>,
    pub current_snapshot_id: Option<String>,
    pub changed: Vec<FileChangeResponse>,
    pub changed_tree: Vec<TreeNodeResponse>,
    pub all_root: Vec<TreeNodeResponse>,
    pub all: Vec<String>,
    pub ignored_directories: Vec<String>,
    pub warnings: Vec<String>,
}
impl From<RepositoryOverview> for RepositoryOverviewResponse {
    fn from(value: RepositoryOverview) -> Self {
        let mut base = BaseResponse::from(&value.base);
        let diff_review_identity =
            value
                .diff_review_identity
                .as_ref()
                .map(|identity| DiffReviewIdentityResponse {
                    repository_id: identity.repository_id().as_str().into(),
                    worktree_id: identity.worktree_id().as_str().into(),
                    base_sha: identity.base_sha().as_str().into(),
                    current_snapshot_id: identity.current_snapshot_id().as_str().into(),
                });

        base.source = value.base_source.map(Into::into);
        Self {
            repository_id: Some(value.repository_id.as_str().into()),
            base,
            diff_review_identity,
            display_worktree_label: Some(value.display_worktree_label),
            current_snapshot_id: value.current_snapshot_id.map(|v| v.as_str().into()),
            changed: value.changed.iter().map(Into::into).collect(),
            changed_tree: value.changed_tree.into_iter().map(Into::into).collect(),
            all_root: value.all_root.into_iter().map(Into::into).collect(),
            all: value.all_paths.iter().map(|p| p.as_str().into()).collect(),
            ignored_directories: value
                .ignored_directories
                .iter()
                .map(|path| path.as_str().into())
                .collect(),
            warnings: value.warnings,
        }
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentResponse {
    pub state: &'static str,
    pub text: Option<String>,
    pub reason: Option<OmissionReasonResponseToken>,
    pub byte_length: Option<u64>,
}
impl From<ContentAvailability> for ContentResponse {
    fn from(value: ContentAvailability) -> Self {
        match value {
            ContentAvailability::Available(text) => Self {
                state: "available",
                text: Some(text),
                reason: None,
                byte_length: None,
            },
            ContentAvailability::Omitted {
                reason,
                byte_length,
            } => Self {
                state: "omitted",
                text: None,
                reason: Some(reason.into()),
                byte_length,
            },
        }
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineResponse {
    pub kind: DiffLineKindResponseToken,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkResponse {
    pub header: String,
    pub lines: Vec<DiffLineResponse>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredDiffResponse {
    pub state: &'static str,
    pub hunks: Vec<DiffHunkResponse>,
    pub reason: Option<OmissionReasonResponseToken>,
}
impl From<StructuredDiff> for StructuredDiffResponse {
    fn from(value: StructuredDiff) -> Self {
        match value {
            StructuredDiff::Available(hunks) => Self {
                state: "available",
                hunks: hunks
                    .into_iter()
                    .map(|hunk| DiffHunkResponse {
                        header: hunk.header,
                        lines: hunk
                            .lines
                            .into_iter()
                            .map(|line| DiffLineResponse {
                                kind: line.kind.into(),
                                text: line.text,
                            })
                            .collect(),
                    })
                    .collect(),
                reason: None,
            },
            StructuredDiff::Omitted { reason } => Self {
                state: "omitted",
                hunks: vec![],
                reason: Some(reason.into()),
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmoduleStateResponse {
    pub base_gitlink_oid: Option<String>,
    pub index_gitlink_oid: Option<String>,
    pub worktree_head_oid: Option<String>,
    pub commit_changed: bool,
    pub tracked_changes: bool,
    pub untracked_changes: bool,
    pub uninitialized: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReviewResponse {
    pub file: FileChangeResponse,
    pub old_content: ContentResponse,
    pub new_content: ContentResponse,
    pub patch: ContentResponse,
    pub structured_diff: StructuredDiffResponse,
    pub submodule: Option<SubmoduleStateResponse>,
}
impl From<FileReview> for FileReviewResponse {
    fn from(value: FileReview) -> Self {
        Self {
            file: (&value.file).into(),
            old_content: value.old_content.into(),
            new_content: value.new_content.into(),
            patch: value.patch.into(),
            structured_diff: value.structured_diff.into(),
            submodule: value.submodule.map(|state| SubmoduleStateResponse {
                base_gitlink_oid: state.base_gitlink_oid.map(|oid| oid.as_str().into()),
                index_gitlink_oid: state.index_gitlink_oid.map(|oid| oid.as_str().into()),
                worktree_head_oid: state.worktree_head_oid.map(|oid| oid.as_str().into()),
                commit_changed: state.commit_changed,
                tracked_changes: state.tracked_changes,
                untracked_changes: state.untracked_changes,
                uninitialized: state.uninitialized,
            }),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryFileReviewResponse {
    pub file: RepositoryFileChangeResponse,
    pub old_content: ContentResponse,
    pub new_content: ContentResponse,
    pub structured_diff: StructuredDiffResponse,
    pub submodule: Option<SubmoduleStateResponse>,
}

impl From<RepositoryFileReview> for RepositoryFileReviewResponse {
    fn from(value: RepositoryFileReview) -> Self {
        Self {
            file: value.file.into(),
            old_content: value.old_content.into(),
            new_content: value.new_content.into(),
            structured_diff: value.structured_diff.into(),
            submodule: value.submodule.map(|state| SubmoduleStateResponse {
                base_gitlink_oid: state.base_gitlink_oid.map(|oid| oid.as_str().into()),
                index_gitlink_oid: state.index_gitlink_oid.map(|oid| oid.as_str().into()),
                worktree_head_oid: state.worktree_head_oid.map(|oid| oid.as_str().into()),
                commit_changed: state.commit_changed,
                tracked_changes: state.tracked_changes,
                untracked_changes: state.untracked_changes,
                uninitialized: state.uninitialized,
            }),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredPageResponse {
    pub node_id: String,
    pub entries: Vec<TreeNodeResponse>,
    pub next_cursor: Option<String>,
}
impl From<IgnoredPage> for IgnoredPageResponse {
    fn from(page: IgnoredPage) -> Self {
        Self {
            node_id: page.node_id,
            entries: page.entries.into_iter().map(Into::into).collect(),
            next_cursor: page.next_cursor,
        }
    }
}

#[tauri::command(async)]
pub fn load_repository_diff(
    state: State<'_, CommandState>,
    request: LoadRepositoryDiffRequest,
) -> Result<RepositoryOverviewResponse, RepositoryCommandError> {
    match state
        .repository_use_cases()
        .load_overview(&request.worktree_id, request.base_override.as_deref())
    {
        Ok(overview) => Ok(overview.into()),
        Err(RepositoryUseCaseError::InvalidOverride { override_ref }) => {
            Ok(RepositoryOverviewResponse {
                repository_id: None,
                diff_review_identity: None,
                display_worktree_label: None,
                base: BaseResponse {
                    state: "invalidOverride",
                    source: None,
                    branch_ref: None,
                    merge_base_sha: None,
                    head_sha: None,
                    reason: Some(BaseResolutionReasonResponseToken::InvalidRef),
                    candidates: vec![],
                    override_ref: Some(override_ref),
                },
                current_snapshot_id: None,
                changed: vec![],
                changed_tree: vec![],
                all_root: vec![],
                all: vec![],
                warnings: vec![],
                ignored_directories: vec![],
            })
        }
        Err(error) => Err(error.into()),
    }
}
#[tauri::command(async)]
pub fn traverse_repository_ignored(
    state: State<'_, CommandState>,
    request: TraverseIgnoredRequest,
) -> Result<IgnoredPageResponse, RepositoryCommandError> {
    state
        .repository_use_cases()
        .traverse_ignored(
            &request.worktree_id,
            &request.current_snapshot_id,
            &request.node_id,
            request.cursor.as_deref(),
        )
        .map(Into::into)
        .map_err(Into::into)
}
#[tauri::command(async)]
pub fn load_repository_file(
    state: State<'_, CommandState>,
    request: LoadRepositoryFileRequest,
) -> Result<RepositoryFileReviewResponse, RepositoryCommandError> {
    state
        .repository_use_cases()
        .load_file(
            &request.worktree_id,
            &request.current_snapshot_id,
            &request.path,
        )
        .map(Into::into)
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_wire_token<T>(value: T, expected: &str)
    where
        T: Serialize,
    {
        assert_eq!(serde_json::to_value(value).unwrap(), expected);
    }

    #[test]
    fn repository_domain_enums_have_exhaustive_wire_tokens() {
        for (value, expected) in [
            (FileChangeKind::Added, "added"),
            (FileChangeKind::Modified, "modified"),
            (FileChangeKind::Deleted, "deleted"),
            (FileChangeKind::Renamed, "renamed"),
            (FileChangeKind::Copied, "copied"),
            (FileChangeKind::TypeChanged, "typeChanged"),
            (FileChangeKind::Untracked, "untracked"),
        ] {
            assert_wire_token(FileChangeKindResponseToken::from(value), expected);
        }
        for (value, expected) in [
            (EntryKind::Regular, "regular"),
            (EntryKind::Symlink, "symlink"),
            (EntryKind::Submodule, "submodule"),
        ] {
            assert_wire_token(EntryKindResponseToken::from(value), expected);
        }
        for (value, expected) in [
            (ContentClassification::Text, "text"),
            (ContentClassification::Binary, "binary"),
            (ContentClassification::NotApplicable, "notApplicable"),
            (ContentClassification::Unknown, "unknown"),
        ] {
            assert_wire_token(ContentClassificationResponseToken::from(value), expected);
        }
        for (value, expected) in [
            (OmissionReason::Binary, "binary"),
            (OmissionReason::LargeFile, "largeFile"),
            (OmissionReason::DiffLimit, "diffLimit"),
            (OmissionReason::MissingSide, "missingSide"),
            (OmissionReason::UnsupportedEntryKind, "unsupportedEntryKind"),
        ] {
            assert_wire_token(OmissionReasonResponseToken::from(value), expected);
        }
        for (value, expected) in [
            (DiffLineKind::Context, "context"),
            (DiffLineKind::Added, "added"),
            (DiffLineKind::Removed, "removed"),
            (DiffLineKind::NoNewline, "noNewline"),
        ] {
            assert_wire_token(DiffLineKindResponseToken::from(value), expected);
        }
    }

    #[test]
    fn base_resolution_domain_enums_have_exhaustive_wire_tokens() {
        for (value, expected) in [
            (BaseResolutionFailure::NotFound, "notFound"),
            (
                BaseResolutionFailure::AmbiguousRemoteHead,
                "ambiguousRemoteHead",
            ),
            (BaseResolutionFailure::DetachedHead, "detachedHead"),
            (BaseResolutionFailure::ShallowHistory, "shallowHistory"),
            (BaseResolutionFailure::UnbornHead, "unbornHead"),
            (BaseResolutionFailure::NoCommonAncestor, "noCommonAncestor"),
        ] {
            assert_wire_token(BaseResolutionReasonResponseToken::from(value), expected);
        }
        assert_wire_token(BaseResolutionReasonResponseToken::MissingRef, "missingRef");
        assert_wire_token(BaseResolutionReasonResponseToken::InvalidRef, "invalidRef");
        for (value, expected) in [
            (BaseResolutionSource::Explicit, "explicit"),
            (BaseResolutionSource::GhMergeBase, "ghMergeBase"),
            (BaseResolutionSource::CurrentRemoteHead, "currentRemoteHead"),
            (BaseResolutionSource::OriginHead, "originHead"),
            (BaseResolutionSource::OtherRemoteHead, "otherRemoteHead"),
            (BaseResolutionSource::Main, "main"),
            (BaseResolutionSource::Master, "master"),
        ] {
            assert_wire_token(BaseResolutionSourceResponseToken::from(value), expected);
        }
    }

    #[test]
    fn base_response_preserves_nullable_wire_contract() {
        let base = BaseBranchResolution::Resolved {
            branch_ref: "refs/heads/main".into(),
            merge_base_sha: CommitSha::parse("a".repeat(40)).unwrap(),
            head_sha: CommitSha::parse("b".repeat(40)).unwrap(),
        };

        let json = serde_json::to_value(BaseResponse::from(&base)).unwrap();

        assert_eq!(
            json,
            serde_json::json!({
                "state": "resolved",
                "source": null,
                "branchRef": "refs/heads/main",
                "mergeBaseSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "headSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "reason": null,
                "candidates": [],
                "overrideRef": null
            })
        );

        let invalid = BaseBranchResolution::InvalidOverride {
            override_ref: "missing".into(),
            missing: true,
        };
        let invalid_json = serde_json::to_value(BaseResponse::from(&invalid)).unwrap();
        assert_eq!(invalid_json["reason"], "missingRef");
    }
    #[test]
    fn lazy_request_uses_current_snapshot_and_opaque_node_id_fields() {
        let request: TraverseIgnoredRequest = serde_json::from_value(serde_json::json!({
            "worktreeId": "/repo",
            "currentSnapshotId": format!("rs1_{}", "0".repeat(64)),
            "nodeId": format!("in1_{}", "1".repeat(64)),
            "cursor": null
        }))
        .unwrap();
        assert!(request.current_snapshot_id.starts_with("rs1_"));
        assert!(request.node_id.starts_with("in1_"));
    }

    #[test]
    fn tree_and_structured_diff_serialize_with_camel_case_contract() {
        let tree = TreeNodeResponse::from(TreeNode {
            path: RepositoryRelativePath::parse("generated").unwrap(),
            name: "generated".into(),
            kind: TreeNodeKind::Directory,
            entry_kind: None,
            change: None,
            ignored: true,
            children: TreeChildren::Deferred {
                node_id: format!("in1_{}", "0".repeat(64)),
            },
        });
        let tree_json = serde_json::to_value(tree).unwrap();
        assert_eq!(tree_json["kind"], "directory");
        assert_eq!(tree_json["children"]["state"], "deferred");
        assert!(tree_json["children"]["nodeId"]
            .as_str()
            .unwrap()
            .starts_with("in1_"));

        let diff = StructuredDiffResponse::from(StructuredDiff::Available(vec![DiffHunk {
            header: "@@ -1 +1 @@".into(),
            lines: vec![DiffLine {
                kind: DiffLineKind::NoNewline,
                text: "marker".into(),
            }],
        }]));
        let diff_json = serde_json::to_value(diff).unwrap();
        assert_eq!(diff_json["state"], "available");
        assert_eq!(diff_json["hunks"][0]["lines"][0]["kind"], "noNewline");
    }

    #[test]
    fn unchanged_repository_file_serializes_nullable_change_and_empty_diff() {
        let response = RepositoryFileReviewResponse::from(RepositoryFileReview {
            file: RepositoryFileMetadata {
                old_path: None,
                new_path: Some(RepositoryRelativePath::parse("src/stable.rs").unwrap()),
                change: None,
                entry_kind: EntryKind::Regular,
                content_classification: ContentClassification::Text,
                similarity: None,
                old_mode: None,
                new_mode: None,
            },
            old_content: ContentAvailability::Omitted {
                reason: OmissionReason::MissingSide,
                byte_length: None,
            },
            new_content: ContentAvailability::Available("one\ntwo\n".into()),
            patch: ContentAvailability::Available(String::new()),
            structured_diff: StructuredDiff::Available(vec![]),
            submodule: None,
        });
        let json = serde_json::to_value(response).unwrap();

        assert_eq!(json["file"]["oldPath"], serde_json::Value::Null);
        assert_eq!(json["file"]["newPath"], "src/stable.rs");
        assert_eq!(json["file"]["change"], serde_json::Value::Null);
        assert_eq!(json["file"]["entryKind"], "regular");
        assert_eq!(json["file"]["contentClassification"], "text");
        assert_eq!(json["newContent"]["state"], "available");
        assert_eq!(json["newContent"]["text"], "one\ntwo\n");
        assert_eq!(json["oldContent"]["state"], "omitted");
        assert_eq!(json["oldContent"]["reason"], "missingSide");
        assert!(json.get("patch").is_none());
        assert_eq!(json["structuredDiff"]["state"], "available");
        assert_eq!(json["structuredDiff"]["hunks"], serde_json::json!([]));
        assert_eq!(json["submodule"], serde_json::Value::Null);
    }

    #[test]
    fn error_code_preserves_consistency_error() {
        let error: RepositoryCommandError =
            RepositoryUseCaseError::Port(RepositoryPortError::StaleSnapshot).into();
        assert_eq!(error.code, "staleSnapshot");
    }
}
