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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryCommandError {
    pub code: String,
    pub message: String,
}
impl From<RepositoryUseCaseError> for RepositoryCommandError {
    fn from(error: RepositoryUseCaseError) -> Self {
        let code = match &error {
            RepositoryUseCaseError::InvalidInput(_)
            | RepositoryUseCaseError::InvalidRepositoryValue => "invalidInput",
            RepositoryUseCaseError::InvalidOverride { .. } => "invalidOverride",
            RepositoryUseCaseError::Port(port) => match port {
                RepositoryPortError::NotRepository => "notRepository",
                RepositoryPortError::BareRepository => "bareRepository",
                RepositoryPortError::WorktreeUnavailable => "worktreeUnavailable",
                RepositoryPortError::CommonDirBoundaryEscape => "commonDirBoundaryEscape",
                RepositoryPortError::GitUnavailable => "gitUnavailable",
                RepositoryPortError::GitTimedOut { .. } => "gitTimedOut",
                RepositoryPortError::GitOutputLimitExceeded { .. } => "gitOutputLimitExceeded",
                RepositoryPortError::GitFailed { .. } => "gitFailed",
                RepositoryPortError::UnsupportedPathEncoding => "unsupportedPathEncoding",
                RepositoryPortError::InvalidRepositoryPath => "invalidRepositoryPath",
                RepositoryPortError::StaleBase => "staleBase",
                RepositoryPortError::StaleSnapshot => "staleSnapshot",
                RepositoryPortError::StaleCursor => "staleCursor",
                RepositoryPortError::InvalidCursor => "invalidCursor",
                RepositoryPortError::EntryChangedDuringRead => "entryChangedDuringRead",
                RepositoryPortError::PermissionDenied => "permissionDenied",
                RepositoryPortError::Io => "io",
            },
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
    pub source: Option<&'static str>,
    pub branch_ref: Option<String>,
    pub merge_base_sha: Option<String>,
    pub head_sha: Option<String>,
    pub reason: Option<&'static str>,
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
                reason: Some(base_reason(*reason)),
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
                reason: Some(if *missing { "missingRef" } else { "invalidRef" }),
                candidates: vec![],
                override_ref: Some(override_ref.clone()),
            },
        }
    }
}
fn base_reason(reason: BaseResolutionFailure) -> &'static str {
    match reason {
        BaseResolutionFailure::NotFound => "notFound",
        BaseResolutionFailure::AmbiguousRemoteHead => "ambiguousRemoteHead",
        BaseResolutionFailure::DetachedHead => "detachedHead",
        BaseResolutionFailure::ShallowHistory => "shallowHistory",
        BaseResolutionFailure::UnbornHead => "unbornHead",
        BaseResolutionFailure::NoCommonAncestor => "noCommonAncestor",
    }
}
fn source(source: Option<BaseResolutionSource>) -> Option<&'static str> {
    source.map(|s| match s {
        BaseResolutionSource::Explicit => "explicit",
        BaseResolutionSource::GhMergeBase => "ghMergeBase",
        BaseResolutionSource::CurrentRemoteHead => "currentRemoteHead",
        BaseResolutionSource::OriginHead => "originHead",
        BaseResolutionSource::OtherRemoteHead => "otherRemoteHead",
        BaseResolutionSource::Main => "main",
        BaseResolutionSource::Master => "master",
    })
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeResponse {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub change: &'static str,
    pub entry_kind: &'static str,
    pub content_classification: &'static str,
    pub similarity: Option<u8>,
    pub old_mode: Option<String>,
    pub new_mode: Option<String>,
}
impl From<&DiffFile> for FileChangeResponse {
    fn from(file: &DiffFile) -> Self {
        Self {
            old_path: file.old_path.as_ref().map(|p| p.as_str().into()),
            new_path: file.new_path.as_ref().map(|p| p.as_str().into()),
            change: match file.change {
                FileChangeKind::Added => "added",
                FileChangeKind::Modified => "modified",
                FileChangeKind::Deleted => "deleted",
                FileChangeKind::Renamed => "renamed",
                FileChangeKind::Copied => "copied",
                FileChangeKind::TypeChanged => "typeChanged",
                FileChangeKind::Untracked => "untracked",
            },
            entry_kind: match file.entry_kind {
                EntryKind::Regular => "regular",
                EntryKind::Symlink => "symlink",
                EntryKind::Submodule => "submodule",
            },
            content_classification: match file.content_classification {
                ContentClassification::Text => "text",
                ContentClassification::Binary => "binary",
                ContentClassification::NotApplicable => "notApplicable",
                ContentClassification::Unknown => "unknown",
            },
            similarity: file.similarity,
            old_mode: file.old_mode.clone(),
            new_mode: file.new_mode.clone(),
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
    pub entry_kind: Option<&'static str>,
    pub change: Option<&'static str>,
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
            entry_kind: node.entry_kind.map(|kind| match kind {
                EntryKind::Regular => "regular",
                EntryKind::Symlink => "symlink",
                EntryKind::Submodule => "submodule",
            }),
            change: node.change.map(|change| match change {
                FileChangeKind::Added => "added",
                FileChangeKind::Modified => "modified",
                FileChangeKind::Deleted => "deleted",
                FileChangeKind::Renamed => "renamed",
                FileChangeKind::Copied => "copied",
                FileChangeKind::TypeChanged => "typeChanged",
                FileChangeKind::Untracked => "untracked",
            }),
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
pub struct RepositoryOverviewResponse {
    pub repository_id: Option<String>,
    pub base: BaseResponse,
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
        base.source = source(value.base_source);
        Self {
            repository_id: Some(value.repository_id.as_str().into()),
            base,
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
    pub reason: Option<&'static str>,
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
                reason: Some(match reason {
                    OmissionReason::Binary => "binary",
                    OmissionReason::LargeFile => "largeFile",
                    OmissionReason::DiffLimit => "diffLimit",
                    OmissionReason::MissingSide => "missingSide",
                    OmissionReason::UnsupportedEntryKind => "unsupportedEntryKind",
                }),
                byte_length,
            },
        }
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineResponse {
    pub kind: &'static str,
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
    pub reason: Option<&'static str>,
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
                                kind: match line.kind {
                                    DiffLineKind::Context => "context",
                                    DiffLineKind::Added => "added",
                                    DiffLineKind::Removed => "removed",
                                    DiffLineKind::NoNewline => "noNewline",
                                },
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
                reason: Some(match reason {
                    OmissionReason::Binary => "binary",
                    OmissionReason::LargeFile => "largeFile",
                    OmissionReason::DiffLimit => "diffLimit",
                    OmissionReason::MissingSide => "missingSide",
                    OmissionReason::UnsupportedEntryKind => "unsupportedEntryKind",
                }),
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

#[tauri::command]
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
                base: BaseResponse {
                    state: "invalidOverride",
                    source: None,
                    branch_ref: None,
                    merge_base_sha: None,
                    head_sha: None,
                    reason: Some("invalidRef"),
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
#[tauri::command]
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
#[tauri::command]
pub fn load_repository_file(
    state: State<'_, CommandState>,
    request: LoadRepositoryFileRequest,
) -> Result<FileReviewResponse, RepositoryCommandError> {
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
    #[test]
    fn base_reasons_are_camel_case() {
        assert_eq!(
            base_reason(BaseResolutionFailure::NoCommonAncestor),
            "noCommonAncestor"
        );
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
    fn error_code_preserves_consistency_error() {
        let error: RepositoryCommandError =
            RepositoryUseCaseError::Port(RepositoryPortError::StaleSnapshot).into();
        assert_eq!(error.code, "staleSnapshot");
    }
}
