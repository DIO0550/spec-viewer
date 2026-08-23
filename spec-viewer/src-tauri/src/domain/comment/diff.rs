//! Pure repository Diff comment concepts.

use std::{
    num::NonZeroU32,
    str::FromStr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::domain::repository::{CommitSha, RepositoryId, RepositoryRelativePath, SnapshotId};

pub const MAX_COMMENT_BODY_BYTES: usize = 16 * 1024;
pub const MAX_CONTEXT_LINES: usize = 3;
pub const MAX_CONTEXT_SCALARS: usize = 256;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DiffCommentError {
    #[error("invalid diff comment value: {0}")]
    InvalidValue(&'static str),
    #[error("revision overflow")]
    RevisionOverflow,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct WorktreeStorageId(String);

impl WorktreeStorageId {
    pub fn parse(value: impl Into<String>) -> Result<Self, DiffCommentError> {
        let value = value.into();
        let valid = value.strip_prefix("rw1_").is_some_and(|hash| {
            hash.len() == 64
                && hash
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
        });
        valid
            .then_some(Self(value))
            .ok_or(DiffCommentError::InvalidValue("worktreeId"))
    }

    pub fn from_canonical_bytes(common_dir: &[u8], worktree_git_dir: &[u8]) -> Self {
        let mut hash = Sha256::new();
        hash.update(b"spec-viewer.worktree-storage-id.v1\0");
        frame(&mut hash, common_dir);
        frame(&mut hash, worktree_git_dir);
        Self(format!("rw1_{}", hex(hash.finalize().as_slice())))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

fn frame(hash: &mut Sha256, value: &[u8]) {
    hash.update((value.len() as u64).to_be_bytes());
    hash.update(value);
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DiffReviewIdentity {
    repository_id: RepositoryId,
    worktree_id: WorktreeStorageId,
    base_sha: CommitSha,
    current_snapshot_id: SnapshotId,
}

impl DiffReviewIdentity {
    pub fn new(
        repository_id: RepositoryId,
        worktree_id: WorktreeStorageId,
        base_sha: CommitSha,
        current_snapshot_id: SnapshotId,
    ) -> Self {
        Self {
            repository_id,
            worktree_id,
            base_sha,
            current_snapshot_id,
        }
    }

    pub fn repository_id(&self) -> &RepositoryId {
        &self.repository_id
    }
    pub fn worktree_id(&self) -> &WorktreeStorageId {
        &self.worktree_id
    }
    pub fn base_sha(&self) -> &CommitSha {
        &self.base_sha
    }
    pub fn current_snapshot_id(&self) -> &SnapshotId {
        &self.current_snapshot_id
    }

    pub fn scope(&self) -> DiffCommentScope {
        DiffCommentScope::new(self.repository_id.clone(), self.worktree_id.clone())
    }
}

/// Stable persistence scope. Base and snapshot belong to anchors/runtime resolution,
/// not to the JSON document envelope.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DiffCommentScope {
    repository_id: RepositoryId,
    worktree_id: WorktreeStorageId,
}

impl DiffCommentScope {
    pub fn new(repository_id: RepositoryId, worktree_id: WorktreeStorageId) -> Self {
        Self {
            repository_id,
            worktree_id,
        }
    }

    pub fn repository_id(&self) -> &RepositoryId {
        &self.repository_id
    }

    pub fn worktree_id(&self) -> &WorktreeStorageId {
        &self.worktree_id
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum DiffSide {
    Base,
    Current,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DiffAnchorTarget {
    side: DiffSide,
    old_path: Option<RepositoryRelativePath>,
    new_path: Option<RepositoryRelativePath>,
    line: NonZeroU32,
    end_line: Option<NonZeroU32>,
}

impl DiffAnchorTarget {
    pub fn new(
        side: DiffSide,
        old_path: Option<RepositoryRelativePath>,
        new_path: Option<RepositoryRelativePath>,
        line: NonZeroU32,
    ) -> Result<Self, DiffCommentError> {
        Self::new_range(side, old_path, new_path, line, None)
    }

    pub fn new_range(
        side: DiffSide,
        old_path: Option<RepositoryRelativePath>,
        new_path: Option<RepositoryRelativePath>,
        line: NonZeroU32,
        end_line: Option<NonZeroU32>,
    ) -> Result<Self, DiffCommentError> {
        let valid = match side {
            DiffSide::Base => old_path.is_some(),
            DiffSide::Current => new_path.is_some(),
        };
        if !valid {
            return Err(DiffCommentError::InvalidValue("sidePath"));
        }
        if end_line.is_some_and(|end| end < line) {
            return Err(DiffCommentError::InvalidValue("endLine"));
        }
        Ok(Self {
            side,
            old_path,
            new_path,
            line,
            end_line: end_line.filter(|end| *end != line),
        })
    }

    pub fn side(&self) -> DiffSide {
        self.side
    }
    pub fn old_path(&self) -> Option<&RepositoryRelativePath> {
        self.old_path.as_ref()
    }
    pub fn new_path(&self) -> Option<&RepositoryRelativePath> {
        self.new_path.as_ref()
    }
    pub fn line(&self) -> NonZeroU32 {
        self.line
    }
    pub fn end_line(&self) -> Option<NonZeroU32> {
        self.end_line
    }
    pub fn range_end_line(&self) -> NonZeroU32 {
        self.end_line.unwrap_or(self.line)
    }
    pub fn side_path(&self) -> &RepositoryRelativePath {
        match self.side {
            DiffSide::Base => self.old_path.as_ref().expect("validated"),
            DiffSide::Current => self.new_path.as_ref().expect("validated"),
        }
    }
    pub fn selection_path(&self) -> &RepositoryRelativePath {
        self.new_path
            .as_ref()
            .or(self.old_path.as_ref())
            .expect("validated")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffLineAnchor {
    identity: DiffReviewIdentity,
    target: DiffAnchorTarget,
    line_hash: String,
    snippet: String,
    context_before: Vec<String>,
    context_after: Vec<String>,
}

impl DiffLineAnchor {
    pub fn new(
        identity: DiffReviewIdentity,
        target: DiffAnchorTarget,
        line_hash: String,
        snippet: String,
        context_before: Vec<String>,
        context_after: Vec<String>,
    ) -> Result<Self, DiffCommentError> {
        if !line_hash.strip_prefix("sha256:").is_some_and(|hash| {
            hash.len() == 64
                && hash
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
        }) {
            return Err(DiffCommentError::InvalidValue("lineHash"));
        }
        if context_before.len() > MAX_CONTEXT_LINES
            || context_after.len() > MAX_CONTEXT_LINES
            || snippet.chars().count() > MAX_CONTEXT_SCALARS
            || context_before
                .iter()
                .chain(&context_after)
                .any(|line| line.chars().count() > MAX_CONTEXT_SCALARS)
        {
            return Err(DiffCommentError::InvalidValue("context"));
        }
        Ok(Self {
            identity,
            target,
            line_hash,
            snippet,
            context_before,
            context_after,
        })
    }

    pub fn identity(&self) -> &DiffReviewIdentity {
        &self.identity
    }
    pub fn target(&self) -> &DiffAnchorTarget {
        &self.target
    }
    pub fn line_hash(&self) -> &str {
        &self.line_hash
    }
    pub fn snippet(&self) -> &str {
        &self.snippet
    }
    pub fn context_before(&self) -> &[String] {
        &self.context_before
    }
    pub fn context_after(&self) -> &[String] {
        &self.context_after
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct DiffCommentRevision(u64);

impl DiffCommentRevision {
    pub const ZERO: Self = Self(0);

    pub fn checked_next(self) -> Result<Self, DiffCommentError> {
        self.0
            .checked_add(1)
            .map(Self)
            .ok_or(DiffCommentError::RevisionOverflow)
    }
    pub fn get(self) -> u64 {
        self.0
    }
}

impl FromStr for DiffCommentRevision {
    type Err = DiffCommentError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        if value.is_empty()
            || value.len() > 20
            || (value.len() > 1 && value.starts_with('0'))
            || !value.bytes().all(|byte| byte.is_ascii_digit())
        {
            return Err(DiffCommentError::InvalidValue("revision"));
        }
        value
            .parse::<u64>()
            .map(Self)
            .map_err(|_| DiffCommentError::InvalidValue("revision"))
    }
}

impl std::fmt::Display for DiffCommentRevision {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}", self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffCommentReply {
    id: CommentId,
    body: String,
    created_at: DateTime<Utc>,
}

impl DiffCommentReply {
    pub fn new(
        id: String,
        body: String,
        created_at: DateTime<Utc>,
    ) -> Result<Self, DiffCommentError> {
        let id = CommentId::parse(id)?;
        validate_body(&body)?;
        Ok(Self {
            id,
            body,
            created_at,
        })
    }

    pub fn id(&self) -> &str {
        self.id.as_str()
    }
    pub fn body(&self) -> &str {
        &self.body
    }
    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredDiffComment {
    id: CommentId,
    body: String,
    resolved: bool,
    created_at: DateTime<Utc>,
    anchor: DiffLineAnchor,
    replies: Vec<DiffCommentReply>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommentId(String);

impl CommentId {
    pub fn parse(value: String) -> Result<Self, DiffCommentError> {
        if value.trim().is_empty() || value.len() > 128 {
            return Err(DiffCommentError::InvalidValue("commentId"));
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl StoredDiffComment {
    pub fn new(
        id: String,
        body: String,
        resolved: bool,
        created_at: DateTime<Utc>,
        anchor: DiffLineAnchor,
    ) -> Result<Self, DiffCommentError> {
        Self::new_with_replies(id, body, resolved, created_at, anchor, vec![])
    }

    pub fn new_with_replies(
        id: String,
        body: String,
        resolved: bool,
        created_at: DateTime<Utc>,
        anchor: DiffLineAnchor,
        replies: Vec<DiffCommentReply>,
    ) -> Result<Self, DiffCommentError> {
        let id = CommentId::parse(id)?;
        validate_body(&body)?;
        let mut reply_ids = std::collections::HashSet::new();
        if replies
            .iter()
            .any(|reply| !reply_ids.insert(reply.id.clone()))
        {
            return Err(DiffCommentError::InvalidValue("duplicateReplyId"));
        }
        Ok(Self {
            id,
            body,
            resolved,
            created_at,
            anchor,
            replies,
        })
    }

    pub fn id(&self) -> &str {
        self.id.as_str()
    }
    pub fn body(&self) -> &str {
        &self.body
    }
    pub fn resolved(&self) -> bool {
        self.resolved
    }
    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }
    pub fn anchor(&self) -> &DiffLineAnchor {
        &self.anchor
    }
    pub fn replies(&self) -> &[DiffCommentReply] {
        &self.replies
    }
    pub fn add_reply(
        &self,
        id: String,
        body: String,
        created_at: DateTime<Utc>,
    ) -> Result<Self, DiffCommentError> {
        let mut replies = self.replies.clone();
        replies.push(DiffCommentReply::new(id, body, created_at)?);
        Self::new_with_replies(
            self.id.0.clone(),
            self.body.clone(),
            self.resolved,
            self.created_at,
            self.anchor.clone(),
            replies,
        )
    }
    pub fn update(
        &self,
        body: Option<String>,
        resolved: Option<bool>,
    ) -> Result<Self, DiffCommentError> {
        Self::new_with_replies(
            self.id.0.clone(),
            body.unwrap_or_else(|| self.body.clone()),
            resolved.unwrap_or(self.resolved),
            self.created_at,
            self.anchor.clone(),
            self.replies.clone(),
        )
    }
}

fn validate_body(body: &str) -> Result<(), DiffCommentError> {
    if body.trim().is_empty() || body.len() > MAX_COMMENT_BODY_BYTES {
        return Err(DiffCommentError::InvalidValue("body"));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredDiffCommentDocument {
    scope: DiffCommentScope,
    revision: DiffCommentRevision,
    comments: Vec<StoredDiffComment>,
}

impl StoredDiffCommentDocument {
    pub fn empty(scope: DiffCommentScope) -> Self {
        Self {
            scope,
            revision: DiffCommentRevision::ZERO,
            comments: vec![],
        }
    }

    pub fn new(
        scope: DiffCommentScope,
        revision: DiffCommentRevision,
        comments: Vec<StoredDiffComment>,
    ) -> Result<Self, DiffCommentError> {
        if comments.len() > 10_000 {
            return Err(DiffCommentError::InvalidValue("comments"));
        }
        let mut ids = std::collections::HashSet::new();
        if comments.iter().any(|comment| {
            comment.anchor.identity.scope() != scope || !ids.insert(comment.id.clone())
        }) {
            return Err(DiffCommentError::InvalidValue(
                "documentIdentityOrDuplicate",
            ));
        }
        Ok(Self {
            scope,
            revision,
            comments,
        })
    }

    pub fn scope(&self) -> &DiffCommentScope {
        &self.scope
    }
    pub fn revision(&self) -> DiffCommentRevision {
        self.revision
    }
    pub fn comments(&self) -> &[StoredDiffComment] {
        &self.comments
    }
    pub fn with_comments(
        &self,
        revision: DiffCommentRevision,
        comments: Vec<StoredDiffComment>,
    ) -> Result<Self, DiffCommentError> {
        Self::new(self.scope.clone(), revision, comments)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StaleAnchorReason {
    SnapshotChanged,
    PathMissing,
    AmbiguousRename,
    ContextNotFound,
    AmbiguousContext,
    Deleted,
    Binary,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UnavailableReason {
    Io,
    Permission,
    BudgetExceeded,
    Cancelled,
    RepositoryChanged,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiffAnchorResolution {
    Exact {
        selection_path: RepositoryRelativePath,
        side_path: RepositoryRelativePath,
        side: DiffSide,
        line: NonZeroU32,
    },
    Relocated {
        selection_path: RepositoryRelativePath,
        side_path: RepositoryRelativePath,
        side: DiffSide,
        line: NonZeroU32,
    },
    Stale {
        reason: StaleAnchorReason,
        candidate_count: u32,
    },
    Unavailable {
        reason: UnavailableReason,
    },
}

impl DiffAnchorResolution {
    pub fn can_jump(&self) -> bool {
        matches!(self, Self::Exact { .. } | Self::Relocated { .. })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedDiffComment {
    pub comment: StoredDiffComment,
    pub anchor_resolution: DiffAnchorResolution,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolutionWarning {
    pub code: ResolutionWarningCode,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ResolutionWarningCode {
    ResolutionUnavailable(UnavailableReason),
    DurabilityUncertain,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedDiffComments {
    /// Current review context used to resolve the historical anchors. This is
    /// deliberately not persisted in the JSON document envelope.
    pub current_identity: DiffReviewIdentity,
    pub document: StoredDiffCommentDocument,
    pub comments: Vec<ResolvedDiffComment>,
    pub resolution_warnings: Vec<ResolutionWarning>,
}

#[derive(Debug, Clone, Default)]
pub struct CancellationToken(Arc<AtomicBool>);

impl CancellationToken {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Release);
    }
    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

pub fn canonical_lines(text: &str) -> Vec<&str> {
    let bytes = text.as_bytes();
    let mut lines = Vec::new();
    let mut start = 0;
    let mut index = 0;
    while index < bytes.len() {
        if matches!(bytes[index], b'\n' | b'\r') {
            lines.push(&text[start..index]);
            if bytes[index] == b'\r' && bytes.get(index + 1) == Some(&b'\n') {
                index += 1;
            }
            start = index + 1;
        }
        index += 1;
    }
    if start < bytes.len() {
        lines.push(&text[start..]);
    }
    lines
}

pub fn line_hash(line: &str) -> String {
    format!("sha256:{}", hex(Sha256::digest(line.as_bytes()).as_slice()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn truncate_context(line: &str) -> String {
    line.chars().take(MAX_CONTEXT_SCALARS).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn revisions_are_canonical_and_checked() {
        for invalid in ["", "00", "01", "-1", "+1", "18446744073709551616"] {
            assert!(invalid.parse::<DiffCommentRevision>().is_err(), "{invalid}");
        }
        assert_eq!(
            "18446744073709551615"
                .parse::<DiffCommentRevision>()
                .unwrap()
                .checked_next(),
            Err(DiffCommentError::RevisionOverflow)
        );
    }

    #[test]
    fn canonical_split_handles_lf_crlf_lone_cr_and_terminal_delimiter() {
        assert_eq!(canonical_lines("a\r\nb\rc\n"), vec!["a", "b", "c"]);
        assert_eq!(canonical_lines("\n"), vec![""]);
    }

    #[test]
    fn storage_identity_is_length_framed() {
        assert_ne!(
            WorktreeStorageId::from_canonical_bytes(b"ab", b"c"),
            WorktreeStorageId::from_canonical_bytes(b"a", b"bc")
        );
    }

    #[test]
    fn anchors_require_the_discriminated_side_path() {
        let line = NonZeroU32::new(1).unwrap();
        assert!(DiffAnchorTarget::new(
            DiffSide::Base,
            None,
            Some(RepositoryRelativePath::parse("a").unwrap()),
            line,
        )
        .is_err());
        assert!(DiffAnchorTarget::new(
            DiffSide::Current,
            None,
            Some(RepositoryRelativePath::parse("a").unwrap()),
            line,
        )
        .is_ok());
    }

    #[test]
    fn anchor_ranges_are_ordered_and_keep_their_end_line() {
        let path = RepositoryRelativePath::parse("src/lib.rs").unwrap();
        let target = DiffAnchorTarget::new_range(
            DiffSide::Current,
            None,
            Some(path.clone()),
            NonZeroU32::new(4).unwrap(),
            Some(NonZeroU32::new(7).unwrap()),
        )
        .unwrap();
        assert_eq!(target.range_end_line(), NonZeroU32::new(7).unwrap());

        assert!(DiffAnchorTarget::new_range(
            DiffSide::Current,
            None,
            Some(path),
            NonZeroU32::new(7).unwrap(),
            Some(NonZeroU32::new(4).unwrap()),
        )
        .is_err());
    }

    #[test]
    fn rename_and_copy_targets_preserve_selection_and_side_paths() {
        let old = RepositoryRelativePath::parse("old/name.rs").unwrap();
        let new = RepositoryRelativePath::parse("new/name.rs").unwrap();
        let line = NonZeroU32::new(7).unwrap();
        let base =
            DiffAnchorTarget::new(DiffSide::Base, Some(old.clone()), Some(new.clone()), line)
                .unwrap();
        assert_eq!(base.selection_path(), &new);
        assert_eq!(base.side_path(), &old);
        let current = DiffAnchorTarget::new(
            DiffSide::Current,
            Some(old.clone()),
            Some(new.clone()),
            line,
        )
        .unwrap();
        assert_eq!(current.selection_path(), &new);
        assert_eq!(current.side_path(), &new);

        let copy_source = RepositoryRelativePath::parse("copy/source.rs").unwrap();
        let copy_target = RepositoryRelativePath::parse("copy/target.rs").unwrap();
        let copied = DiffAnchorTarget::new(
            DiffSide::Current,
            Some(copy_source),
            Some(copy_target.clone()),
            line,
        )
        .unwrap();
        assert_eq!(copied.selection_path(), &copy_target);
        assert_eq!(copied.side_path(), &copy_target);
    }
}
