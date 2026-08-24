//! Repository-wide Git comparison concepts.
use chrono::{DateTime, FixedOffset};
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RepositoryError {
    #[error("invalid repository value: {0}")]
    InvalidValue(String),
}

fn is_lower_hex(byte: u8) -> bool {
    byte.is_ascii_digit() || matches!(byte, b'a'..=b'f')
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct RepositoryId(String);
impl RepositoryId {
    pub fn parse(value: impl Into<String>) -> Result<Self, RepositoryError> {
        let value = value.into();
        if value
            .strip_prefix("rr1_")
            .is_some_and(|hash| hash.len() == 64 && hash.bytes().all(is_lower_hex))
        {
            Ok(Self(value))
        } else {
            Err(RepositoryError::InvalidValue(value))
        }
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommitSha(String);
impl CommitSha {
    pub fn parse(value: impl Into<String>) -> Result<Self, RepositoryError> {
        let value = value.into();
        if matches!(value.len(), 40 | 64) && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            Ok(Self(value))
        } else {
            Err(RepositoryError::InvalidValue(value))
        }
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SnapshotId(String);
impl SnapshotId {
    pub fn parse(value: impl Into<String>) -> Result<Self, RepositoryError> {
        let value = value.into();
        if value
            .strip_prefix("rs1_")
            .is_some_and(|hash| hash.len() == 64 && hash.bytes().all(is_lower_hex))
        {
            Ok(Self(value))
        } else {
            Err(RepositoryError::InvalidValue(value))
        }
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Strict UTF-8 slash-separated Git identity, unrelated to configured Spec file keys.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct RepositoryRelativePath(String);
impl RepositoryRelativePath {
    pub fn parse(value: impl Into<String>) -> Result<Self, RepositoryError> {
        let value = value.into();
        let invalid = value.is_empty()
            || value.starts_with('/')
            || value.contains('\\')
            || value.as_bytes().get(1) == Some(&b':')
            || value
                .bytes()
                .any(|byte| byte == 0 || byte < 0x20 || byte == 0x7f)
            || value
                .split('/')
                .any(|part| part.is_empty() || part == "." || part == "..");
        if invalid {
            Err(RepositoryError::InvalidValue(value))
        } else {
            Ok(Self(value))
        }
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ComparisonRevision {
    Head,
    Commit(CommitSha),
    LocalBranch(crate::domain::workspace::ValidatedRefName),
    Tag(crate::domain::workspace::ValidatedRefName),
}

impl ComparisonRevision {
    pub fn local_branch(
        reference: crate::domain::workspace::ValidatedRefName,
    ) -> Result<Self, RepositoryError> {
        if !reference.as_str().starts_with("refs/heads/") {
            return Err(RepositoryError::InvalidValue(reference.as_str().into()));
        }
        Ok(Self::LocalBranch(reference))
    }

    pub fn tag(
        reference: crate::domain::workspace::ValidatedRefName,
    ) -> Result<Self, RepositoryError> {
        if !reference.as_str().starts_with("refs/tags/") {
            return Err(RepositoryError::InvalidValue(reference.as_str().into()));
        }
        Ok(Self::Tag(reference))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RevisionOption {
    pub revision: ComparisonRevision,
    pub label: String,
    pub resolved_commit: CommitSha,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFileCommit {
    pub commit: CommitSha,
    pub committed_at: DateTime<FixedOffset>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFileHistory {
    pub items: Vec<SpecFileCommit>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BaseResolutionFailure {
    NotFound,
    AmbiguousRemoteHead,
    DetachedHead,
    ShallowHistory,
    UnbornHead,
    NoCommonAncestor,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BaseBranchResolution {
    Resolved {
        branch_ref: String,
        merge_base_sha: CommitSha,
        head_sha: CommitSha,
    },
    NeedsSelection {
        reason: BaseResolutionFailure,
        candidates: Vec<String>,
    },
    InvalidOverride {
        override_ref: String,
        missing: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileChangeKind {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
    Untracked,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiffFileSides {
    Added {
        new_path: RepositoryRelativePath,
        new_mode: Option<GitFileMode>,
    },
    Modified {
        path: RepositoryRelativePath,
        old_mode: Option<GitFileMode>,
        new_mode: Option<GitFileMode>,
    },
    Deleted {
        old_path: RepositoryRelativePath,
        old_mode: Option<GitFileMode>,
    },
    Renamed {
        old_path: RepositoryRelativePath,
        new_path: RepositoryRelativePath,
        similarity: Option<u8>,
        old_mode: Option<GitFileMode>,
        new_mode: Option<GitFileMode>,
    },
    Copied {
        old_path: RepositoryRelativePath,
        new_path: RepositoryRelativePath,
        similarity: Option<u8>,
        old_mode: Option<GitFileMode>,
        new_mode: Option<GitFileMode>,
    },
    TypeChanged {
        path: RepositoryRelativePath,
        old_mode: Option<GitFileMode>,
        new_mode: Option<GitFileMode>,
    },
    Untracked {
        new_path: RepositoryRelativePath,
        new_mode: Option<GitFileMode>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DiffFileModes {
    pub old: Option<GitFileMode>,
    pub new: Option<GitFileMode>,
}

impl DiffFileSides {
    pub fn old_path(&self) -> Option<&RepositoryRelativePath> {
        match self {
            Self::Added { .. } | Self::Untracked { .. } => None,
            Self::Modified { path, .. } | Self::TypeChanged { path, .. } => Some(path),
            Self::Deleted { old_path, .. }
            | Self::Renamed { old_path, .. }
            | Self::Copied { old_path, .. } => Some(old_path),
        }
    }

    pub fn new_path(&self) -> Option<&RepositoryRelativePath> {
        match self {
            Self::Deleted { .. } => None,
            Self::Added { new_path, .. }
            | Self::Untracked { new_path, .. }
            | Self::Modified { path: new_path, .. }
            | Self::TypeChanged { path: new_path, .. }
            | Self::Renamed { new_path, .. }
            | Self::Copied { new_path, .. } => Some(new_path),
        }
    }

    pub const fn change(&self) -> FileChangeKind {
        match self {
            Self::Added { .. } => FileChangeKind::Added,
            Self::Modified { .. } => FileChangeKind::Modified,
            Self::Deleted { .. } => FileChangeKind::Deleted,
            Self::Renamed { .. } => FileChangeKind::Renamed,
            Self::Copied { .. } => FileChangeKind::Copied,
            Self::TypeChanged { .. } => FileChangeKind::TypeChanged,
            Self::Untracked { .. } => FileChangeKind::Untracked,
        }
    }

    pub fn with_modes(self, modes: DiffFileModes) -> Self {
        match self {
            Self::Added { new_path, .. } => Self::Added {
                new_path,
                new_mode: modes.new,
            },
            Self::Modified { path, .. } => Self::Modified {
                path,
                old_mode: modes.old,
                new_mode: modes.new,
            },
            Self::Deleted { old_path, .. } => Self::Deleted {
                old_path,
                old_mode: modes.old,
            },
            Self::Renamed {
                old_path,
                new_path,
                similarity,
                ..
            } => Self::Renamed {
                old_path,
                new_path,
                similarity,
                old_mode: modes.old,
                new_mode: modes.new,
            },
            Self::Copied {
                old_path,
                new_path,
                similarity,
                ..
            } => Self::Copied {
                old_path,
                new_path,
                similarity,
                old_mode: modes.old,
                new_mode: modes.new,
            },
            Self::TypeChanged { path, .. } => Self::TypeChanged {
                path,
                old_mode: modes.old,
                new_mode: modes.new,
            },
            Self::Untracked { new_path, .. } => Self::Untracked {
                new_path,
                new_mode: modes.new,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntryKind {
    Regular,
    Symlink,
    Submodule,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GitFileMode {
    Regular,
    Executable,
    Symlink,
    Submodule,
    Directory,
}

impl GitFileMode {
    pub const fn entry_kind(self) -> Option<EntryKind> {
        match self {
            Self::Regular | Self::Executable => Some(EntryKind::Regular),
            Self::Symlink => Some(EntryKind::Symlink),
            Self::Submodule => Some(EntryKind::Submodule),
            Self::Directory => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RepositoryWarning {
    SimilarityDetectionLimit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContentClassification {
    Text,
    Binary,
    NotApplicable,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DiffFileMetadata {
    pub entry_kind: EntryKind,
    pub content_classification: ContentClassification,
}

impl DiffFileMetadata {
    pub const fn new(entry_kind: EntryKind, content_classification: ContentClassification) -> Self {
        Self {
            entry_kind,
            content_classification,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmissionReason {
    Binary,
    LargeFile,
    DiffLimit,
    MissingSide,
    UnsupportedEntryKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BaseResolutionSource {
    Explicit,
    GhMergeBase,
    CurrentRemoteHead,
    OriginHead,
    OtherRemoteHead,
    Main,
    Master,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffFile {
    pub(crate) old_path: Option<RepositoryRelativePath>,
    pub(crate) new_path: Option<RepositoryRelativePath>,
    pub(crate) change: FileChangeKind,
    pub(crate) entry_kind: EntryKind,
    pub(crate) content_classification: ContentClassification,
    pub(crate) similarity: Option<u8>,
    pub(crate) old_mode: Option<GitFileMode>,
    pub(crate) new_mode: Option<GitFileMode>,
}

impl DiffFile {
    pub fn new(sides: DiffFileSides, metadata: DiffFileMetadata) -> Result<Self, RepositoryError> {
        let (old_path, new_path, change, similarity, old_mode, new_mode) = match sides {
            DiffFileSides::Added { new_path, new_mode } => (
                None,
                Some(new_path),
                FileChangeKind::Added,
                None,
                None,
                new_mode,
            ),
            DiffFileSides::Modified {
                path,
                old_mode,
                new_mode,
            } => (
                Some(path.clone()),
                Some(path),
                FileChangeKind::Modified,
                None,
                old_mode,
                new_mode,
            ),
            DiffFileSides::Deleted { old_path, old_mode } => (
                Some(old_path),
                None,
                FileChangeKind::Deleted,
                None,
                old_mode,
                None,
            ),
            DiffFileSides::Renamed {
                old_path,
                new_path,
                similarity,
                old_mode,
                new_mode,
            } => (
                Some(old_path),
                Some(new_path),
                FileChangeKind::Renamed,
                similarity,
                old_mode,
                new_mode,
            ),
            DiffFileSides::Copied {
                old_path,
                new_path,
                similarity,
                old_mode,
                new_mode,
            } => (
                Some(old_path),
                Some(new_path),
                FileChangeKind::Copied,
                similarity,
                old_mode,
                new_mode,
            ),
            DiffFileSides::TypeChanged {
                path,
                old_mode,
                new_mode,
            } => (
                Some(path.clone()),
                Some(path),
                FileChangeKind::TypeChanged,
                None,
                old_mode,
                new_mode,
            ),
            DiffFileSides::Untracked { new_path, new_mode } => (
                None,
                Some(new_path),
                FileChangeKind::Untracked,
                None,
                None,
                new_mode,
            ),
        };
        let sides_valid = match change {
            FileChangeKind::Added | FileChangeKind::Untracked => {
                old_path.is_none() && new_path.is_some()
            }
            FileChangeKind::Deleted => old_path.is_some() && new_path.is_none(),
            FileChangeKind::Modified | FileChangeKind::TypeChanged => {
                old_path.is_some() && old_path == new_path
            }
            FileChangeKind::Renamed | FileChangeKind::Copied => {
                old_path.is_some() && new_path.is_some() && old_path != new_path
            }
        };
        let similarity_valid = match change {
            FileChangeKind::Renamed | FileChangeKind::Copied => {
                similarity.is_some_and(|value| (50..=100).contains(&value))
            }
            _ => similarity.is_none(),
        };
        let modes_supported =
            old_mode != Some(GitFileMode::Directory) && new_mode != Some(GitFileMode::Directory);
        let entry_kind_matches_mode = match new_mode.or(old_mode) {
            Some(mode) => mode.entry_kind() == Some(metadata.entry_kind),
            None => true,
        };
        if !sides_valid || !similarity_valid || !modes_supported || !entry_kind_matches_mode {
            return Err(RepositoryError::InvalidValue(
                "invalid diff file state".into(),
            ));
        }
        Ok(Self {
            old_path,
            new_path,
            change,
            entry_kind: metadata.entry_kind,
            content_classification: metadata.content_classification,
            similarity,
            old_mode,
            new_mode,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TreeNodeKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TreeChildren {
    Loaded(Vec<TreeNode>),
    Deferred { node_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreeNode {
    pub path: RepositoryRelativePath,
    pub name: String,
    pub kind: TreeNodeKind,
    pub entry_kind: Option<EntryKind>,
    pub change: Option<FileChangeKind>,
    pub ignored: bool,
    pub children: TreeChildren,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepositoryOverview {
    pub repository_id: RepositoryId,
    pub diff_review_identity: Option<crate::domain::comment::diff::DiffReviewIdentity>,
    pub display_worktree_label: String,
    pub base: BaseBranchResolution,
    pub base_source: Option<BaseResolutionSource>,
    pub current_snapshot_id: Option<SnapshotId>,
    pub changed: Vec<DiffFile>,
    pub changed_tree: Vec<TreeNode>,
    pub all_root: Vec<TreeNode>,
    pub all_paths: Vec<RepositoryRelativePath>,
    pub ignored_directories: Vec<RepositoryRelativePath>,
    pub warnings: Vec<RepositoryWarning>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContentAvailability {
    Available(String),
    Omitted {
        reason: OmissionReason,
        byte_length: Option<u64>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffLineKind {
    Context,
    Added,
    Removed,
    NoNewline,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StructuredDiff {
    Available(Vec<DiffHunk>),
    Omitted { reason: OmissionReason },
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SubmoduleState {
    pub base_gitlink_oid: Option<CommitSha>,
    pub index_gitlink_oid: Option<CommitSha>,
    pub worktree_head_oid: Option<CommitSha>,
    pub commit_changed: bool,
    pub tracked_changes: bool,
    pub untracked_changes: bool,
    pub uninitialized: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileReview {
    pub file: DiffFile,
    pub old_content: ContentAvailability,
    pub new_content: ContentAvailability,
    pub structured_diff: StructuredDiff,
    pub submodule: Option<SubmoduleState>,
    pub patch: ContentAvailability,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepositoryFileMetadata {
    pub(crate) old_path: Option<RepositoryRelativePath>,
    pub(crate) new_path: Option<RepositoryRelativePath>,
    pub(crate) change: Option<FileChangeKind>,
    pub entry_kind: EntryKind,
    pub content_classification: ContentClassification,
    pub similarity: Option<u8>,
    pub old_mode: Option<GitFileMode>,
    pub new_mode: Option<GitFileMode>,
}

impl From<DiffFile> for RepositoryFileMetadata {
    fn from(file: DiffFile) -> Self {
        Self {
            old_path: file.old_path,
            new_path: file.new_path,
            change: Some(file.change),
            entry_kind: file.entry_kind,
            content_classification: file.content_classification,
            similarity: file.similarity,
            old_mode: file.old_mode,
            new_mode: file.new_mode,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepositoryFileReview {
    pub file: RepositoryFileMetadata,
    pub old_content: ContentAvailability,
    pub new_content: ContentAvailability,
    pub structured_diff: StructuredDiff,
    pub submodule: Option<SubmoduleState>,
    pub patch: ContentAvailability,
}

impl From<FileReview> for RepositoryFileReview {
    fn from(review: FileReview) -> Self {
        Self {
            file: review.file.into(),
            old_content: review.old_content,
            new_content: review.new_content,
            structured_diff: review.structured_diff,
            submodule: review.submodule,
            patch: review.patch,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IgnoredPage {
    pub node_id: String,
    pub directory: RepositoryRelativePath,
    pub entries: Vec<TreeNode>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkingTreeDiffOverview {
    pub diff_review_identity: crate::domain::comment::diff::DiffReviewIdentity,
    pub resolved_base_sha: CommitSha,
    pub current_snapshot_id: SnapshotId,
    pub changed: Vec<DiffFile>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StdioStream {
    Stdout,
    Stderr,
}

impl StdioStream {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Stdout => "stdout",
            Self::Stderr => "stderr",
        }
    }
}

impl std::fmt::Display for StdioStream {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RepositoryPortError {
    #[error("repository HEAD does not exist")]
    UnbornHead,
    #[error("repository HEAD changed during read")]
    HeadChangedDuringRead,
    #[error("not a Git repository")]
    NotRepository,
    #[error("bare repository")]
    BareRepository,
    #[error("worktree unavailable")]
    WorktreeUnavailable,
    #[error("Git metadata boundary escape")]
    CommonDirBoundaryEscape,
    #[error("Git unavailable")]
    GitUnavailable,
    #[error("repository identity mismatch")]
    IdentityMismatch,
    #[error("Git timed out: {operation}")]
    GitTimedOut { operation: String },
    #[error("Git output limit exceeded: {stream}")]
    GitOutputLimitExceeded { stream: StdioStream },
    #[error("Git failed: {operation}")]
    GitFailed {
        operation: String,
        code: Option<i32>,
        stderr: String,
    },
    #[error("unsupported path encoding")]
    UnsupportedPathEncoding,
    #[error("comparison revision was not found")]
    RevisionNotFound,
    #[error("comparison revision does not resolve to a commit")]
    RevisionNotCommit,
    #[error("invalid Git history output")]
    InvalidHistoryOutput,
    #[error("invalid repository path")]
    InvalidRepositoryPath,
    #[error("unsupported Git diff status code: {code:?}")]
    UnsupportedDiffStatus { code: char },
    #[error("stale base")]
    StaleBase,
    #[error("stale snapshot")]
    StaleSnapshot,
    #[error("stale cursor")]
    StaleCursor,
    #[error("invalid cursor")]
    InvalidCursor,
    #[error("entry changed during read")]
    EntryChangedDuringRead,
    #[error("operation cancelled")]
    Cancelled,
    #[error("content exceeds review limit")]
    ContentTooLarge,
    #[error("permission denied")]
    PermissionDenied,
    #[error("I/O error")]
    Io,
}

pub trait RepositoryPort {
    fn load_overview(
        &self,
        worktree: &crate::domain::workspace::WorktreeId,
        override_ref: Option<&crate::domain::workspace::ValidatedRefName>,
    ) -> Result<RepositoryOverview, RepositoryPortError>;
    fn traverse_ignored(
        &self,
        worktree: &crate::domain::workspace::WorktreeId,
        snapshot: &SnapshotId,
        node_id: &str,
        cursor: Option<&str>,
    ) -> Result<IgnoredPage, RepositoryPortError>;
    fn load_file(
        &self,
        worktree: &crate::domain::workspace::WorktreeId,
        snapshot: &SnapshotId,
        path: &RepositoryRelativePath,
    ) -> Result<RepositoryFileReview, RepositoryPortError>;
}

pub trait WorkingTreeDiffPort {
    fn list_comparison_revisions(
        &self,
        worktree: &crate::domain::workspace::WorktreeId,
    ) -> Result<Vec<RevisionOption>, RepositoryPortError>;

    fn list_file_history(
        &self,
        worktree: &crate::domain::workspace::WorktreeId,
        path: &RepositoryRelativePath,
        limit: usize,
    ) -> Result<SpecFileHistory, RepositoryPortError>;

    fn load_working_tree_overview(
        &self,
        worktree: &crate::domain::workspace::WorktreeId,
        comparison: &ComparisonRevision,
    ) -> Result<WorkingTreeDiffOverview, RepositoryPortError>;

    fn load_working_tree_file(
        &self,
        worktree: &crate::domain::workspace::WorktreeId,
        snapshot: &SnapshotId,
        resolved_base: &CommitSha,
        path: &RepositoryRelativePath,
    ) -> Result<FileReview, RepositoryPortError>;
}

#[cfg(test)]
mod tests {
    use crate::domain::workspace::ValidatedRefName;

    #[test]
    fn git_file_modes_derive_entry_kinds_exhaustively() {
        for (mode, expected) in [
            (GitFileMode::Regular, Some(EntryKind::Regular)),
            (GitFileMode::Executable, Some(EntryKind::Regular)),
            (GitFileMode::Symlink, Some(EntryKind::Symlink)),
            (GitFileMode::Submodule, Some(EntryKind::Submodule)),
            (GitFileMode::Directory, None),
        ] {
            assert_eq!(mode.entry_kind(), expected);
        }
    }

    #[test]
    fn stdio_stream_tokens_and_error_display_match_the_wire_contract() {
        for (stream, expected) in [
            (StdioStream::Stdout, "stdout"),
            (StdioStream::Stderr, "stderr"),
        ] {
            assert_eq!(stream.as_str(), expected);
            assert_eq!(stream.to_string(), expected);
            assert_eq!(
                RepositoryPortError::GitOutputLimitExceeded { stream }.to_string(),
                format!("Git output limit exceeded: {expected}")
            );
        }
    }

    #[test]
    fn comparison_revision_accepts_head_commit_and_canonical_local_refs() {
        let commit = CommitSha::parse("a".repeat(40)).unwrap();

        assert_eq!(ComparisonRevision::Head, ComparisonRevision::Head);
        assert!(matches!(
            ComparisonRevision::Commit(commit),
            ComparisonRevision::Commit(_)
        ));
        assert!(ComparisonRevision::local_branch(
            ValidatedRefName::parse("refs/heads/feature/revisions").unwrap()
        )
        .is_ok());
        assert!(
            ComparisonRevision::tag(ValidatedRefName::parse("refs/tags/v1.2.3").unwrap()).is_ok()
        );
    }

    #[test]
    fn comparison_revision_rejects_short_remote_and_mismatched_refs() {
        for value in [
            "feature/revisions",
            "refs/remotes/origin/main",
            "refs/tags/v1",
        ] {
            let reference = ValidatedRefName::parse(value).unwrap();
            assert!(ComparisonRevision::local_branch(reference).is_err());
        }

        let branch = ValidatedRefName::parse("refs/heads/main").unwrap();
        assert!(ComparisonRevision::tag(branch).is_err());
    }

    #[test]
    fn working_tree_overview_requires_head_snapshot_and_changes() {
        let head_sha = CommitSha::parse("a".repeat(40)).unwrap();
        let snapshot = SnapshotId::parse(format!("rs1_{}", "b".repeat(64))).unwrap();
        let identity = crate::domain::comment::diff::DiffReviewIdentity::new(
            RepositoryId::parse(format!("rr1_{}", "c".repeat(64))).unwrap(),
            crate::domain::comment::diff::WorktreeStorageId::parse(format!(
                "rw1_{}",
                "d".repeat(64)
            ))
            .unwrap(),
            head_sha.clone(),
            snapshot.clone(),
        );
        let overview = WorkingTreeDiffOverview {
            diff_review_identity: identity,
            resolved_base_sha: head_sha.clone(),
            current_snapshot_id: snapshot.clone(),
            changed: vec![],
        };

        assert_eq!(overview.resolved_base_sha, head_sha);
        assert_eq!(overview.current_snapshot_id, snapshot);
        assert!(overview.changed.is_empty());
    }

    #[test]
    fn working_tree_race_errors_remain_distinct() {
        assert_ne!(
            RepositoryPortError::UnbornHead,
            RepositoryPortError::HeadChangedDuringRead
        );
        assert_ne!(
            RepositoryPortError::HeadChangedDuringRead,
            RepositoryPortError::EntryChangedDuringRead
        );
    }

    use super::*;
    fn diff_file(
        old_path: Option<&str>,
        new_path: Option<&str>,
        change: FileChangeKind,
        similarity: Option<u8>,
    ) -> Result<DiffFile, RepositoryError> {
        let sides = match change {
            FileChangeKind::Added => DiffFileSides::Added {
                new_path: RepositoryRelativePath::parse(new_path.unwrap()).unwrap(),
                new_mode: None,
            },
            FileChangeKind::Modified => DiffFileSides::Modified {
                path: RepositoryRelativePath::parse(old_path.unwrap()).unwrap(),
                old_mode: None,
                new_mode: None,
            },
            FileChangeKind::Deleted => DiffFileSides::Deleted {
                old_path: RepositoryRelativePath::parse(old_path.unwrap()).unwrap(),
                old_mode: None,
            },
            FileChangeKind::Renamed => DiffFileSides::Renamed {
                old_path: RepositoryRelativePath::parse(old_path.unwrap()).unwrap(),
                new_path: RepositoryRelativePath::parse(new_path.unwrap()).unwrap(),
                similarity,
                old_mode: None,
                new_mode: None,
            },
            FileChangeKind::Copied => DiffFileSides::Copied {
                old_path: RepositoryRelativePath::parse(old_path.unwrap()).unwrap(),
                new_path: RepositoryRelativePath::parse(new_path.unwrap()).unwrap(),
                similarity,
                old_mode: None,
                new_mode: None,
            },
            FileChangeKind::TypeChanged => DiffFileSides::TypeChanged {
                path: RepositoryRelativePath::parse(old_path.unwrap()).unwrap(),
                old_mode: None,
                new_mode: None,
            },
            FileChangeKind::Untracked => DiffFileSides::Untracked {
                new_path: RepositoryRelativePath::parse(new_path.unwrap()).unwrap(),
                new_mode: None,
            },
        };
        DiffFile::new(
            sides,
            DiffFileMetadata::new(EntryKind::Regular, ContentClassification::Text),
        )
    }

    #[test]
    fn diff_file_rejects_invalid_side_and_similarity_combinations() {
        assert!(diff_file(None, Some("new"), FileChangeKind::Added, None).is_ok());
        assert!(diff_file(Some("old"), None, FileChangeKind::Deleted, None).is_ok());
        assert!(diff_file(Some("old"), Some("new"), FileChangeKind::Renamed, Some(50)).is_ok());
        assert!(diff_file(Some("old"), Some("old"), FileChangeKind::Renamed, Some(100)).is_err());
        assert!(diff_file(Some("old"), Some("new"), FileChangeKind::Copied, Some(49)).is_err());
        assert!(diff_file(Some("old"), Some("new"), FileChangeKind::Copied, None).is_err());
    }

    #[test]
    fn diff_file_rejects_directory_and_mode_entry_kind_mismatches() {
        let path = || RepositoryRelativePath::parse("mode.txt").unwrap();
        let invalid_states = [
            (
                EntryKind::Regular,
                Some(GitFileMode::Regular),
                Some(GitFileMode::Submodule),
            ),
            (
                EntryKind::Symlink,
                Some(GitFileMode::Regular),
                Some(GitFileMode::Regular),
            ),
            (
                EntryKind::Regular,
                Some(GitFileMode::Directory),
                Some(GitFileMode::Directory),
            ),
        ];

        for (entry_kind, old_mode, new_mode) in invalid_states {
            assert_eq!(
                DiffFile::new(
                    DiffFileSides::Modified {
                        path: path(),
                        old_mode,
                        new_mode,
                    },
                    DiffFileMetadata::new(entry_kind, ContentClassification::Text),
                ),
                Err(RepositoryError::InvalidValue(
                    "invalid diff file state".into()
                ))
            );
        }

        assert!(DiffFile::new(
            DiffFileSides::Modified {
                path: path(),
                old_mode: Some(GitFileMode::Regular),
                new_mode: Some(GitFileMode::Executable),
            },
            DiffFileMetadata::new(EntryKind::Regular, ContentClassification::Text),
        )
        .is_ok());
    }

    #[test]
    fn identifiers_reject_empty_values() {
        assert!(RepositoryId::parse("").is_err());
        assert!(RepositoryId::parse(format!("rr1_{}", "f".repeat(64))).is_ok());
        assert!(RepositoryId::parse(format!("rs1_{}", "f".repeat(64))).is_err());
        assert!(RepositoryId::parse(format!("rr1_{}", "F".repeat(64))).is_err());
        assert!(SnapshotId::parse("").is_err());
        assert!(CommitSha::parse("a".repeat(40)).is_ok());
        assert!(CommitSha::parse("not-a-sha").is_err());
        assert!(SnapshotId::parse(format!("rs1_{}", "0".repeat(64))).is_ok());
        assert!(SnapshotId::parse(format!("rs1_{}", "A".repeat(64))).is_err());
        for invalid in [
            "",
            "/absolute",
            ".",
            "..",
            "a//b",
            "a/../b",
            "a\\b",
            "C:/absolute",
        ] {
            assert!(
                RepositoryRelativePath::parse(invalid).is_err(),
                "{invalid} must be rejected"
            );
        }
        assert!(RepositoryRelativePath::parse("src/日本語.rs").is_ok());
    }
}
