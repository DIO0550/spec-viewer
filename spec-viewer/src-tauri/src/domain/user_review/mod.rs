//! User review domain concepts.

use std::{
    collections::{HashMap, HashSet},
    fmt,
};

use chrono::{DateTime, Utc};
use thiserror::Error;
use uuid::{Uuid, Variant, Version};

use crate::domain::{
    comment::{CommentBody, CommentId, CommentStatus, TextSnippet},
    spec::{MarkdownBlockHash, MarkdownBlockType, SpecFileKey, SpecId},
    workspace::WorkspaceRelativePath,
};

const USER_REVIEW_ID_PREFIX: &str = "urv_";
const USER_REVIEW_ID_HEX_LENGTH: usize = 32;
const USER_REVIEW_ID_LENGTH: usize = USER_REVIEW_ID_PREFIX.len() + USER_REVIEW_ID_HEX_LENGTH;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct UserReviewId {
    value: String,
}

impl UserReviewId {
    pub fn new(value: impl Into<String>) -> Result<Self, UserReviewDomainError> {
        let value = value.into();

        if !is_canonical_user_review_id(&value) {
            return Err(UserReviewDomainError::InvalidUserReviewId { value });
        }

        Ok(Self { value })
    }

    pub fn from_uuid(uuid: Uuid) -> Result<Self, UserReviewDomainError> {
        if uuid.get_version() != Some(Version::Random) || uuid.get_variant() != Variant::RFC4122 {
            return Err(UserReviewDomainError::InvalidUserReviewUuid { uuid });
        }

        Self::new(format!("{USER_REVIEW_ID_PREFIX}{}", uuid.simple()))
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for UserReviewId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UserReviewStatus {
    Active,
    Archived,
}

impl UserReviewStatus {
    pub fn is_archived(self) -> bool {
        matches!(self, Self::Archived)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum UserReviewTarget {
    File {
        spec_id: SpecId,
        file_key: SpecFileKey,
    },
    Spec {
        spec_id: SpecId,
    },
}

impl UserReviewTarget {
    pub fn file(spec_id: SpecId, file_key: SpecFileKey) -> Self {
        Self::File { spec_id, file_key }
    }

    pub fn spec(spec_id: SpecId) -> Self {
        Self::Spec { spec_id }
    }

    pub fn spec_id(&self) -> &SpecId {
        match self {
            Self::File { spec_id, .. } | Self::Spec { spec_id } => spec_id,
        }
    }

    pub fn file_key(&self) -> Option<SpecFileKey> {
        match self {
            Self::File { file_key, .. } => Some(*file_key),
            Self::Spec { .. } => None,
        }
    }

    fn validate_source(
        &self,
        comment_id: &CommentId,
        source: &UserReviewSource,
    ) -> Result<(), UserReviewDomainError> {
        if self.spec_id() != source.spec_id() {
            return Err(UserReviewDomainError::CommentSourceSpecMismatch {
                comment_id: comment_id.clone(),
                target_spec_id: self.spec_id().clone(),
                source_spec_id: source.spec_id().clone(),
            });
        }

        if let Some(target_file_key) = self.file_key() {
            if target_file_key != source.file_key() {
                return Err(UserReviewDomainError::CommentSourceFileMismatch {
                    comment_id: comment_id.clone(),
                    target_file_key,
                    source_file_key: source.file_key(),
                });
            }
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserReviewSource {
    spec_id: SpecId,
    file_key: SpecFileKey,
    file_path: WorkspaceRelativePath,
}

impl UserReviewSource {
    pub fn new(spec_id: SpecId, file_key: SpecFileKey, file_path: WorkspaceRelativePath) -> Self {
        Self {
            spec_id,
            file_key,
            file_path,
        }
    }

    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn file_path(&self) -> &WorkspaceRelativePath {
        &self.file_path
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PositiveLineNumber {
    value: u32,
}

impl PositiveLineNumber {
    pub fn new(value: u32) -> Result<Self, UserReviewDomainError> {
        if value == 0 {
            return Err(UserReviewDomainError::InvalidLineNumber { value });
        }

        Ok(Self { value })
    }

    pub fn value(self) -> u32 {
        self.value
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewComment {
    id: CommentId,
    status: CommentStatus,
    source: UserReviewSource,
    block_type: MarkdownBlockType,
    line_start: PositiveLineNumber,
    line_end: PositiveLineNumber,
    text_snippet: TextSnippet,
    text_hash: MarkdownBlockHash,
    body: CommentBody,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl UserReviewComment {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: CommentId,
        status: CommentStatus,
        source: UserReviewSource,
        block_type: MarkdownBlockType,
        line_start: PositiveLineNumber,
        line_end: PositiveLineNumber,
        text_snippet: TextSnippet,
        text_hash: MarkdownBlockHash,
        body: CommentBody,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Result<Self, UserReviewDomainError> {
        if line_end < line_start {
            return Err(UserReviewDomainError::InvalidLineRange {
                start: line_start,
                end: line_end,
            });
        }

        if updated_at < created_at {
            return Err(UserReviewDomainError::CommentUpdatedBeforeCreated {
                id,
                created_at,
                updated_at,
            });
        }

        Ok(Self {
            id,
            status,
            source,
            block_type,
            line_start,
            line_end,
            text_snippet,
            text_hash,
            body,
            created_at,
            updated_at,
        })
    }

    pub fn id(&self) -> &CommentId {
        &self.id
    }

    pub fn status(&self) -> CommentStatus {
        self.status
    }

    pub fn source(&self) -> &UserReviewSource {
        &self.source
    }

    pub fn block_type(&self) -> MarkdownBlockType {
        self.block_type
    }

    pub fn line_start(&self) -> PositiveLineNumber {
        self.line_start
    }

    pub fn line_end(&self) -> PositiveLineNumber {
        self.line_end
    }

    pub fn text_snippet(&self) -> &TextSnippet {
        &self.text_snippet
    }

    pub fn text_hash(&self) -> &MarkdownBlockHash {
        &self.text_hash
    }

    pub fn body(&self) -> &CommentBody {
        &self.body
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    fn source_identity(&self) -> UserReviewCommentSourceIdentity<'_> {
        UserReviewCommentSourceIdentity {
            spec_id: self.source.spec_id(),
            file_key: self.source.file_key(),
            file_path: self.source.file_path(),
            block_type: self.block_type,
            line_start: self.line_start,
            line_end: self.line_end,
            text_hash: &self.text_hash,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct UserReviewCommentSourceIdentity<'a> {
    spec_id: &'a SpecId,
    file_key: SpecFileKey,
    file_path: &'a WorkspaceRelativePath,
    block_type: MarkdownBlockType,
    line_start: PositiveLineNumber,
    line_end: PositiveLineNumber,
    text_hash: &'a MarkdownBlockHash,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserReviewArchiveTransition {
    Archived,
    AlreadyArchived,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReview {
    id: UserReviewId,
    status: UserReviewStatus,
    target: UserReviewTarget,
    comments: Vec<UserReviewComment>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    archived_at: Option<DateTime<Utc>>,
}

impl UserReview {
    pub fn new(
        id: UserReviewId,
        target: UserReviewTarget,
        comments: Vec<UserReviewComment>,
        created_at: DateTime<Utc>,
    ) -> Result<Self, UserReviewDomainError> {
        Self::restore(
            id,
            UserReviewStatus::Active,
            target,
            comments,
            created_at,
            created_at,
            None,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        id: UserReviewId,
        status: UserReviewStatus,
        target: UserReviewTarget,
        comments: Vec<UserReviewComment>,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
        archived_at: Option<DateTime<Utc>>,
    ) -> Result<Self, UserReviewDomainError> {
        validate_review_timestamps(status, created_at, updated_at, archived_at)?;
        validate_comments(&target, &comments)?;

        Ok(Self {
            id,
            status,
            target,
            comments,
            created_at,
            updated_at,
            archived_at,
        })
    }

    pub fn archive(
        &mut self,
        requested_id: &UserReviewId,
        requested_target: &UserReviewTarget,
        archived_at: DateTime<Utc>,
    ) -> Result<UserReviewArchiveTransition, UserReviewDomainError> {
        if &self.id != requested_id {
            return Err(UserReviewDomainError::ArchiveIdentityMismatch {
                aggregate_id: self.id.clone(),
                requested_id: requested_id.clone(),
            });
        }

        if &self.target != requested_target {
            return Err(UserReviewDomainError::ArchiveTargetMismatch {
                aggregate_target: self.target.clone(),
                requested_target: requested_target.clone(),
            });
        }

        if self.status.is_archived() {
            return Ok(UserReviewArchiveTransition::AlreadyArchived);
        }

        if archived_at < self.updated_at {
            return Err(UserReviewDomainError::ArchiveTimestampRollback {
                current_updated_at: self.updated_at,
                attempted_archived_at: archived_at,
            });
        }

        self.status = UserReviewStatus::Archived;
        self.updated_at = archived_at;
        self.archived_at = Some(archived_at);

        Ok(UserReviewArchiveTransition::Archived)
    }

    pub fn id(&self) -> &UserReviewId {
        &self.id
    }

    pub fn status(&self) -> UserReviewStatus {
        self.status
    }

    pub fn target(&self) -> &UserReviewTarget {
        &self.target
    }

    pub fn comments(&self) -> &[UserReviewComment] {
        &self.comments
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    pub fn archived_at(&self) -> Option<DateTime<Utc>> {
        self.archived_at
    }
}

fn validate_comments(
    target: &UserReviewTarget,
    comments: &[UserReviewComment],
) -> Result<(), UserReviewDomainError> {
    if comments.is_empty() {
        return Err(UserReviewDomainError::MissingComments);
    }

    let mut comment_ids = HashSet::with_capacity(comments.len());
    let mut source_identities = HashMap::with_capacity(comments.len());

    for comment in comments {
        if !comment_ids.insert(comment.id().clone()) {
            return Err(UserReviewDomainError::DuplicateCommentId {
                id: comment.id().clone(),
            });
        }

        target.validate_source(comment.id(), comment.source())?;

        if let Some(first_id) =
            source_identities.insert(comment.source_identity(), comment.id().clone())
        {
            return Err(UserReviewDomainError::DuplicateCommentSource {
                first_id,
                duplicate_id: comment.id().clone(),
            });
        }
    }

    Ok(())
}

fn validate_review_timestamps(
    status: UserReviewStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    archived_at: Option<DateTime<Utc>>,
) -> Result<(), UserReviewDomainError> {
    if updated_at < created_at {
        return Err(UserReviewDomainError::ReviewUpdatedBeforeCreated {
            created_at,
            updated_at,
        });
    }

    match status {
        UserReviewStatus::Active => {
            if let Some(archived_at) = archived_at {
                return Err(UserReviewDomainError::ActiveReviewHasArchivedAt { archived_at });
            }

            if created_at != updated_at {
                return Err(UserReviewDomainError::ActiveTimestampsDiffer {
                    created_at,
                    updated_at,
                });
            }
        }
        UserReviewStatus::Archived => {
            let archived_at =
                archived_at.ok_or(UserReviewDomainError::ArchivedReviewMissingArchivedAt)?;

            if updated_at != archived_at {
                return Err(UserReviewDomainError::ArchivedTimestampsDiffer {
                    updated_at,
                    archived_at,
                });
            }
        }
    }

    Ok(())
}

fn is_canonical_user_review_id(value: &str) -> bool {
    let bytes = value.as_bytes();

    bytes.len() == USER_REVIEW_ID_LENGTH
        && bytes.starts_with(USER_REVIEW_ID_PREFIX.as_bytes())
        && bytes[USER_REVIEW_ID_PREFIX.len()..]
            .iter()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(byte))
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewDomainError {
    #[error("user review ID must match ^urv_[0-9a-f]{{32}}$: {value}")]
    InvalidUserReviewId { value: String },
    #[error("user review ID generation requires an RFC UUID v4: {uuid}")]
    InvalidUserReviewUuid { uuid: Uuid },
    #[error("user review requires at least one comment snapshot")]
    MissingComments,
    #[error("duplicate comment ID in user review: {id}")]
    DuplicateCommentId { id: CommentId },
    #[error(
        "duplicate comment source identity in user review: first {first_id}, duplicate {duplicate_id}"
    )]
    DuplicateCommentSource {
        first_id: CommentId,
        duplicate_id: CommentId,
    },
    #[error(
        "comment {comment_id} source spec {source_spec_id} does not match target spec {target_spec_id}"
    )]
    CommentSourceSpecMismatch {
        comment_id: CommentId,
        target_spec_id: SpecId,
        source_spec_id: SpecId,
    },
    #[error(
        "comment {comment_id} source file {source_file_key} does not match target file {target_file_key}"
    )]
    CommentSourceFileMismatch {
        comment_id: CommentId,
        target_file_key: SpecFileKey,
        source_file_key: SpecFileKey,
    },
    #[error("user review line number must be positive: {value}")]
    InvalidLineNumber { value: u32 },
    #[error("user review line range end {end:?} cannot be before start {start:?}")]
    InvalidLineRange {
        start: PositiveLineNumber,
        end: PositiveLineNumber,
    },
    #[error(
        "comment {id} updated timestamp {updated_at} cannot be before created timestamp {created_at}"
    )]
    CommentUpdatedBeforeCreated {
        id: CommentId,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    },
    #[error(
        "user review updated timestamp {updated_at} cannot be before created timestamp {created_at}"
    )]
    ReviewUpdatedBeforeCreated {
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    },
    #[error("active user review cannot have archived timestamp {archived_at}")]
    ActiveReviewHasArchivedAt { archived_at: DateTime<Utc> },
    #[error(
        "active user review created timestamp {created_at} must equal updated timestamp {updated_at}"
    )]
    ActiveTimestampsDiffer {
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    },
    #[error("archived user review requires an archived timestamp")]
    ArchivedReviewMissingArchivedAt,
    #[error(
        "archived user review updated timestamp {updated_at} must equal archived timestamp {archived_at}"
    )]
    ArchivedTimestampsDiffer {
        updated_at: DateTime<Utc>,
        archived_at: DateTime<Utc>,
    },
    #[error(
        "archive timestamp {attempted_archived_at} cannot be before current updated timestamp {current_updated_at}"
    )]
    ArchiveTimestampRollback {
        current_updated_at: DateTime<Utc>,
        attempted_archived_at: DateTime<Utc>,
    },
    #[error(
        "archive request identity {requested_id} does not match aggregate identity {aggregate_id}"
    )]
    ArchiveIdentityMismatch {
        aggregate_id: UserReviewId,
        requested_id: UserReviewId,
    },
    #[error(
        "archive request target {requested_target:?} does not match aggregate target {aggregate_target:?}"
    )]
    ArchiveTargetMismatch {
        aggregate_target: UserReviewTarget,
        requested_target: UserReviewTarget,
    },
}
