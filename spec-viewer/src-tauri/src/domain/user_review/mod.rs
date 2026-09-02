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

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewIdViolation {
    #[error("prefix must be urv_")]
    InvalidPrefix,
    #[error("payload length must be {expected}, got {actual}")]
    InvalidLength { expected: usize, actual: usize },
    #[error("payload contains non-lowercase-hex character {character:?} at {index}")]
    InvalidHexCharacter { index: usize, character: char },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct UserReviewId {
    value: String,
}

impl UserReviewId {
    pub fn new(value: impl Into<String>) -> Result<Self, UserReviewDomainError> {
        Self::try_from(value.into())
    }

    pub fn from_uuid(uuid: Uuid) -> Result<Self, UserReviewDomainError> {
        if uuid.get_version() != Some(Version::Random) || uuid.get_variant() != Variant::RFC4122 {
            return Err(UserReviewDomainError::InvalidUserReviewUuid { uuid });
        }

        Self::try_from(format!("{USER_REVIEW_ID_PREFIX}{}", uuid.simple()))
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl TryFrom<String> for UserReviewId {
    type Error = UserReviewDomainError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        let violation = match value.strip_prefix(USER_REVIEW_ID_PREFIX) {
            None => Some(UserReviewIdViolation::InvalidPrefix),
            Some(payload) if payload.len() != USER_REVIEW_ID_HEX_LENGTH => {
                Some(UserReviewIdViolation::InvalidLength {
                    expected: USER_REVIEW_ID_HEX_LENGTH,
                    actual: payload.len(),
                })
            }
            Some(payload) => payload.char_indices().find_map(|(index, character)| {
                (!matches!(character, '0'..='9' | 'a'..='f'))
                    .then_some(UserReviewIdViolation::InvalidHexCharacter { index, character })
            }),
        };

        match violation {
            Some(violation) => Err(UserReviewDomainError::InvalidUserReviewId { value, violation }),
            None => Ok(Self { value }),
        }
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LineRange {
    start: PositiveLineNumber,
    end: PositiveLineNumber,
}

impl LineRange {
    pub fn new(
        start: PositiveLineNumber,
        end: PositiveLineNumber,
    ) -> Result<Self, UserReviewDomainError> {
        if end < start {
            return Err(UserReviewDomainError::InvalidLineRange { start, end });
        }

        Ok(Self { start, end })
    }

    pub fn start(self) -> PositiveLineNumber {
        self.start
    }

    pub fn end(self) -> PositiveLineNumber {
        self.end
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewAnchor {
    source: UserReviewSource,
    block_type: MarkdownBlockType,
    line_range: LineRange,
    text_snippet: TextSnippet,
    text_hash: MarkdownBlockHash,
}

impl UserReviewAnchor {
    pub fn new(
        source: UserReviewSource,
        block_type: MarkdownBlockType,
        line_range: LineRange,
        text_snippet: TextSnippet,
        text_hash: MarkdownBlockHash,
    ) -> Self {
        Self {
            source,
            block_type,
            line_range,
            text_snippet,
            text_hash,
        }
    }

    pub fn source(&self) -> &UserReviewSource {
        &self.source
    }

    pub fn block_type(&self) -> MarkdownBlockType {
        self.block_type
    }

    pub fn line_range(&self) -> LineRange {
        self.line_range
    }

    pub fn text_snippet(&self) -> &TextSnippet {
        &self.text_snippet
    }

    pub fn text_hash(&self) -> &MarkdownBlockHash {
        &self.text_hash
    }

    fn identity(&self) -> UserReviewAnchorIdentity<'_> {
        UserReviewAnchorIdentity {
            spec_id: self.source.spec_id(),
            file_key: self.source.file_key(),
            file_path: self.source.file_path(),
            block_type: self.block_type,
            line_range: self.line_range,
            text_hash: &self.text_hash,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct UserReviewAnchorIdentity<'a> {
    spec_id: &'a SpecId,
    file_key: SpecFileKey,
    file_path: &'a WorkspaceRelativePath,
    block_type: MarkdownBlockType,
    line_range: LineRange,
    text_hash: &'a MarkdownBlockHash,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewComment {
    id: CommentId,
    status: CommentStatus,
    anchor: UserReviewAnchor,
    body: CommentBody,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl UserReviewComment {
    pub fn new(
        id: CommentId,
        status: CommentStatus,
        anchor: UserReviewAnchor,
        body: CommentBody,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Result<Self, UserReviewDomainError> {
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
            anchor,
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

    pub fn anchor(&self) -> &UserReviewAnchor {
        &self.anchor
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
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewContent {
    target: UserReviewTarget,
    comments: Vec<UserReviewComment>,
}

impl UserReviewContent {
    pub fn new(
        target: UserReviewTarget,
        comments: Vec<UserReviewComment>,
    ) -> Result<Self, UserReviewDomainError> {
        if comments.is_empty() {
            return Err(UserReviewDomainError::MissingComments);
        }

        {
            let mut comment_ids = HashSet::with_capacity(comments.len());
            let mut source_identities = HashMap::with_capacity(comments.len());

            for comment in &comments {
                if !comment_ids.insert(comment.id().clone()) {
                    return Err(UserReviewDomainError::DuplicateCommentId {
                        id: comment.id().clone(),
                    });
                }

                let source = comment.anchor().source();
                if target.spec_id() != source.spec_id() {
                    return Err(UserReviewDomainError::CommentSourceSpecMismatch {
                        comment_id: comment.id().clone(),
                        target_spec_id: target.spec_id().clone(),
                        source_spec_id: source.spec_id().clone(),
                    });
                }

                if let Some(target_file_key) = target.file_key() {
                    if target_file_key != source.file_key() {
                        return Err(UserReviewDomainError::CommentSourceFileMismatch {
                            comment_id: comment.id().clone(),
                            target_file_key,
                            source_file_key: source.file_key(),
                        });
                    }
                }

                if let Some(first_id) =
                    source_identities.insert(comment.anchor().identity(), comment.id().clone())
                {
                    return Err(UserReviewDomainError::DuplicateCommentSource {
                        first_id,
                        duplicate_id: comment.id().clone(),
                    });
                }
            }
        }

        Ok(Self { target, comments })
    }

    pub fn target(&self) -> &UserReviewTarget {
        &self.target
    }

    pub fn comments(&self) -> &[UserReviewComment] {
        &self.comments
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserReviewArchiveTransition {
    Archived,
    AlreadyArchived,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum UserReviewLifecycleState {
    Active,
    Archived { archived_at: DateTime<Utc> },
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct UserReviewLifecycle {
    created_at: DateTime<Utc>,
    state: UserReviewLifecycleState,
}

impl UserReviewLifecycle {
    fn active(created_at: DateTime<Utc>) -> Self {
        Self {
            created_at,
            state: UserReviewLifecycleState::Active,
        }
    }

    fn restore(
        status: UserReviewStatus,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
        archived_at: Option<DateTime<Utc>>,
    ) -> Result<Self, UserReviewDomainError> {
        if updated_at < created_at {
            return Err(UserReviewDomainError::ReviewUpdatedBeforeCreated {
                created_at,
                updated_at,
            });
        }

        match (status, archived_at) {
            (UserReviewStatus::Active, Some(archived_at)) => {
                Err(UserReviewDomainError::ActiveReviewHasArchivedAt { archived_at })
            }
            (UserReviewStatus::Active, None) if updated_at != created_at => {
                Err(UserReviewDomainError::ActiveTimestampsDiffer {
                    created_at,
                    updated_at,
                })
            }
            (UserReviewStatus::Active, None) => Ok(Self::active(created_at)),
            (UserReviewStatus::Archived, None) => {
                Err(UserReviewDomainError::ArchivedReviewMissingArchivedAt)
            }
            (UserReviewStatus::Archived, Some(archived_at)) if updated_at != archived_at => {
                Err(UserReviewDomainError::ArchivedTimestampsDiffer {
                    updated_at,
                    archived_at,
                })
            }
            (UserReviewStatus::Archived, Some(archived_at)) => Ok(Self {
                created_at,
                state: UserReviewLifecycleState::Archived { archived_at },
            }),
        }
    }

    fn archive(
        &mut self,
        archived_at: DateTime<Utc>,
    ) -> Result<UserReviewArchiveTransition, UserReviewDomainError> {
        if matches!(&self.state, UserReviewLifecycleState::Archived { .. }) {
            return Ok(UserReviewArchiveTransition::AlreadyArchived);
        }

        if archived_at < self.updated_at() {
            return Err(UserReviewDomainError::ArchiveTimestampRollback {
                current_updated_at: self.updated_at(),
                attempted_archived_at: archived_at,
            });
        }

        self.state = UserReviewLifecycleState::Archived { archived_at };
        Ok(UserReviewArchiveTransition::Archived)
    }

    fn status(&self) -> UserReviewStatus {
        match &self.state {
            UserReviewLifecycleState::Active => UserReviewStatus::Active,
            UserReviewLifecycleState::Archived { .. } => UserReviewStatus::Archived,
        }
    }

    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> DateTime<Utc> {
        match &self.state {
            UserReviewLifecycleState::Active => self.created_at,
            UserReviewLifecycleState::Archived { archived_at } => *archived_at,
        }
    }

    fn archived_at(&self) -> Option<DateTime<Utc>> {
        match &self.state {
            UserReviewLifecycleState::Active => None,
            UserReviewLifecycleState::Archived { archived_at } => Some(*archived_at),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReview {
    id: UserReviewId,
    content: UserReviewContent,
    lifecycle: UserReviewLifecycle,
}

impl UserReview {
    pub fn new(id: UserReviewId, content: UserReviewContent, created_at: DateTime<Utc>) -> Self {
        Self {
            id,
            content,
            lifecycle: UserReviewLifecycle::active(created_at),
        }
    }

    pub fn restore(
        id: UserReviewId,
        content: UserReviewContent,
        status: UserReviewStatus,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
        archived_at: Option<DateTime<Utc>>,
    ) -> Result<Self, UserReviewDomainError> {
        let lifecycle = UserReviewLifecycle::restore(status, created_at, updated_at, archived_at)?;

        Ok(Self {
            id,
            content,
            lifecycle,
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

        if self.content.target() != requested_target {
            return Err(UserReviewDomainError::ArchiveTargetMismatch {
                aggregate_target: self.content.target().clone(),
                requested_target: requested_target.clone(),
            });
        }

        self.lifecycle.archive(archived_at)
    }

    pub fn id(&self) -> &UserReviewId {
        &self.id
    }

    pub fn status(&self) -> UserReviewStatus {
        self.lifecycle.status()
    }

    pub fn target(&self) -> &UserReviewTarget {
        self.content.target()
    }

    pub fn comments(&self) -> &[UserReviewComment] {
        self.content.comments()
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.lifecycle.created_at()
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.lifecycle.updated_at()
    }

    pub fn archived_at(&self) -> Option<DateTime<Utc>> {
        self.lifecycle.archived_at()
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserReviewDomainError {
    #[error("user review ID is invalid: {value}: {violation}")]
    InvalidUserReviewId {
        value: String,
        violation: UserReviewIdViolation,
    },
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
