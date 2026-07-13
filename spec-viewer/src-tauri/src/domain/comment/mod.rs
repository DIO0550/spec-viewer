//! Comment domain concepts.

use std::{collections::HashSet, fmt};

use chrono::{DateTime, Utc};
use thiserror::Error;
use uuid::Uuid;

use crate::domain::spec::{MarkdownBlock, MarkdownBlockType, SpecFileKey};

#[cfg(test)]
mod id_tests;
mod repository;
#[cfg(test)]
mod scoped_comments_tests;

pub use repository::{
    CommentListQuery, CommentRepository, CommentRepositoryError, CommentScope, CommentStatusFilter,
};

const COMMENT_ID_PREFIX: &str = "cmt_";

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommentId {
    value: String,
}

impl CommentId {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(CommentDomainError::MissingCommentId);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn generate(uuid: Uuid) -> Self {
        Self {
            value: format!("{COMMENT_ID_PREFIX}{}", uuid.simple()),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for CommentId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentBody {
    value: String,
}

impl CommentBody {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(CommentDomainError::MissingCommentBody);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CommentStatus {
    Open,
    Resolved,
}

impl CommentStatus {
    pub fn is_resolved(self) -> bool {
        matches!(self, Self::Resolved)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AnchorResolutionStatus {
    Resolved,
    Moved,
    Fuzzy,
    Orphaned,
}

impl AnchorResolutionStatus {
    pub fn is_orphaned(self) -> bool {
        matches!(self, Self::Orphaned)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AnchorResolutionReason {
    ExactMatch,
    MovedByHash,
    StaleSnippet,
    FuzzyMatch,
    MissingOriginalBlock,
    AmbiguousFuzzyCandidates,
    BelowThreshold,
    DeletedText,
    UnsupportedBlockType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BlockType {
    Paragraph,
    Heading,
    ListItem,
    CodeBlock,
    BlockQuote,
    Table,
    ThematicBreak,
    Html,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct BlockIndex {
    value: usize,
}

impl BlockIndex {
    pub fn new(value: usize) -> Self {
        Self { value }
    }

    pub fn value(self) -> usize {
        self.value
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TextHash {
    value: String,
}

impl TextHash {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(CommentDomainError::MissingTextHash);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for TextHash {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextSnippet {
    value: String,
}

impl TextSnippet {
    pub fn new(value: impl Into<String>) -> Result<Self, CommentDomainError> {
        let value = value.into();

        if value.trim().is_empty() {
            return Err(CommentDomainError::MissingTextSnippet);
        }

        Ok(Self { value })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CharRange {
    start: usize,
    end: usize,
}

impl CharRange {
    pub fn new(start: usize, end: usize) -> Result<Self, CommentDomainError> {
        if end < start {
            return Err(CommentDomainError::InvalidCharRange { start, end });
        }

        Ok(Self { start, end })
    }

    pub fn start(self) -> usize {
        self.start
    }

    pub fn end(self) -> usize {
        self.end
    }

    pub fn len(self) -> usize {
        self.end - self.start
    }

    pub fn is_empty(self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentAnchor {
    file_key: SpecFileKey,
    block_type: BlockType,
    block_index: BlockIndex,
    text_hash: TextHash,
    text_snippet: TextSnippet,
    char_range: CharRange,
}

impl CommentAnchor {
    pub fn new(
        file_key: SpecFileKey,
        block_type: BlockType,
        block_index: BlockIndex,
        text_hash: TextHash,
        text_snippet: TextSnippet,
        char_range: CharRange,
    ) -> Self {
        Self {
            file_key,
            block_type,
            block_index,
            text_hash,
            text_snippet,
            char_range,
        }
    }

    pub fn from_markdown_block(
        file_key: SpecFileKey,
        block: &MarkdownBlock,
        text_snippet: TextSnippet,
        char_range: CharRange,
    ) -> Result<Self, CommentDomainError> {
        Ok(Self::new(
            file_key,
            BlockType::from(block.block_type()),
            BlockIndex::new(block.index().value()),
            TextHash::new(block.text_hash().as_str())?,
            text_snippet,
            char_range,
        ))
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn block_type(&self) -> BlockType {
        self.block_type
    }

    pub fn block_index(&self) -> BlockIndex {
        self.block_index
    }

    pub fn text_hash(&self) -> &TextHash {
        &self.text_hash
    }

    pub fn text_snippet(&self) -> &TextSnippet {
        &self.text_snippet
    }

    pub fn char_range(&self) -> CharRange {
        self.char_range
    }
}

impl From<MarkdownBlockType> for BlockType {
    fn from(block_type: MarkdownBlockType) -> Self {
        match block_type {
            MarkdownBlockType::Paragraph => Self::Paragraph,
            MarkdownBlockType::Heading => Self::Heading,
            MarkdownBlockType::ListItem => Self::ListItem,
            MarkdownBlockType::CodeBlock => Self::CodeBlock,
            MarkdownBlockType::BlockQuote => Self::BlockQuote,
            MarkdownBlockType::Table => Self::Table,
            MarkdownBlockType::ThematicBreak => Self::ThematicBreak,
            MarkdownBlockType::Html => Self::Html,
            MarkdownBlockType::Other => Self::Other,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Comment {
    id: CommentId,
    anchor: CommentAnchor,
    body: CommentBody,
    status: CommentStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Comment {
    pub fn new(
        id: CommentId,
        anchor: CommentAnchor,
        body: CommentBody,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Result<Self, CommentDomainError> {
        if updated_at < created_at {
            return Err(CommentDomainError::UpdatedBeforeCreated);
        }

        Ok(Self {
            id,
            anchor,
            body,
            status: CommentStatus::Open,
            created_at,
            updated_at,
        })
    }

    pub fn restore(
        id: CommentId,
        anchor: CommentAnchor,
        body: CommentBody,
        status: CommentStatus,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Result<Self, CommentDomainError> {
        if updated_at < created_at {
            return Err(CommentDomainError::UpdatedBeforeCreated);
        }

        Ok(Self {
            id,
            anchor,
            body,
            status,
            created_at,
            updated_at,
        })
    }

    pub fn id(&self) -> &CommentId {
        &self.id
    }

    pub fn anchor(&self) -> &CommentAnchor {
        &self.anchor
    }

    pub fn body(&self) -> &CommentBody {
        &self.body
    }

    pub fn status(&self) -> CommentStatus {
        self.status
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    pub fn is_resolved(&self) -> bool {
        self.status.is_resolved()
    }

    pub fn update_body(
        &mut self,
        body: CommentBody,
        updated_at: DateTime<Utc>,
    ) -> Result<(), CommentDomainError> {
        self.ensure_update_time(updated_at)?;
        self.body = body;
        self.updated_at = updated_at;
        Ok(())
    }

    pub fn resolve(&mut self, updated_at: DateTime<Utc>) -> Result<(), CommentDomainError> {
        self.ensure_update_time(updated_at)?;
        self.status = CommentStatus::Resolved;
        self.updated_at = updated_at;
        Ok(())
    }

    pub fn reopen(&mut self, updated_at: DateTime<Utc>) -> Result<(), CommentDomainError> {
        self.ensure_update_time(updated_at)?;
        self.status = CommentStatus::Open;
        self.updated_at = updated_at;
        Ok(())
    }

    pub(crate) fn ensure_update_time(
        &self,
        updated_at: DateTime<Utc>,
    ) -> Result<(), CommentDomainError> {
        if updated_at < self.created_at {
            return Err(CommentDomainError::UpdatedBeforeCreated);
        }

        if updated_at < self.updated_at {
            return Err(CommentDomainError::UpdatedAtRollback {
                current: self.updated_at,
                attempted: updated_at,
            });
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentThread {
    root: Comment,
    replies: Vec<Comment>,
}

impl CommentThread {
    pub fn new(root: Comment, replies: Vec<Comment>) -> Result<Self, CommentDomainError> {
        let mut seen_ids = HashSet::from([root.id().clone()]);

        for reply in &replies {
            if !seen_ids.insert(reply.id().clone()) {
                return Err(CommentDomainError::DuplicateCommentId {
                    id: reply.id().clone(),
                });
            }
        }

        Ok(Self { root, replies })
    }

    pub fn root(&self) -> &Comment {
        &self.root
    }

    pub fn replies(&self) -> &[Comment] {
        &self.replies
    }

    pub fn comments(&self) -> impl Iterator<Item = &Comment> {
        std::iter::once(&self.root).chain(self.replies.iter())
    }

    pub fn is_resolved(&self) -> bool {
        self.comments().all(Comment::is_resolved)
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CommentDomainError {
    #[error("comment id is required")]
    MissingCommentId,
    #[error("comment body is required")]
    MissingCommentBody,
    #[error("anchor text hash is required")]
    MissingTextHash,
    #[error("anchor text snippet is required")]
    MissingTextSnippet,
    #[error("anchor char range end {end} cannot be before start {start}")]
    InvalidCharRange { start: usize, end: usize },
    #[error("comment updated timestamp cannot be before created timestamp")]
    UpdatedBeforeCreated,
    #[error(
        "comment updated timestamp {attempted} cannot be before current updated timestamp {current}"
    )]
    UpdatedAtRollback {
        current: DateTime<Utc>,
        attempted: DateTime<Utc>,
    },
    #[error("duplicate comment id in thread: {id}")]
    DuplicateCommentId { id: CommentId },
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::spec::{
        MarkdownBlock, MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockSourceRange,
        MarkdownBlockText, MarkdownBlockType,
    };

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-05T00:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn anchor_for_file(file_key: SpecFileKey) -> CommentAnchor {
        CommentAnchor::new(
            file_key,
            BlockType::Paragraph,
            BlockIndex::new(2),
            TextHash::new("block-hash").expect("hash should be valid"),
            TextSnippet::new("Selected text").expect("snippet should be valid"),
            CharRange::new(4, 17).expect("range should be valid"),
        )
    }

    fn comment_with_id(id: &str) -> Comment {
        Comment::new(
            CommentId::new(id).expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Looks good").expect("body should be valid"),
            timestamp(1),
            timestamp(1),
        )
        .expect("comment should be valid")
    }

    #[test]
    fn comment_id_accepts_and_trims_non_empty_value() {
        let id = CommentId::new("  comment-1  ").expect("id should be valid");

        assert_eq!("comment-1", id.as_str());
        assert_eq!("comment-1", id.to_string());
    }

    #[test]
    fn comment_id_rejects_empty_value() {
        let result = CommentId::new("   ");

        assert_eq!(Err(CommentDomainError::MissingCommentId), result);
    }

    #[test]
    fn comment_body_accepts_and_trims_non_empty_value() {
        let body = CommentBody::new("  Please clarify this.  ").expect("body should be valid");

        assert_eq!("Please clarify this.", body.as_str());
    }

    #[test]
    fn comment_body_rejects_empty_value() {
        let result = CommentBody::new("   ");

        assert_eq!(Err(CommentDomainError::MissingCommentBody), result);
    }

    #[test]
    fn block_index_keeps_zero_based_position() {
        let index = BlockIndex::new(3);

        assert_eq!(3, index.value());
    }

    #[test]
    fn text_hash_accepts_and_trims_non_empty_value() {
        let hash = TextHash::new("  sha256-prefix  ").expect("hash should be valid");

        assert_eq!("sha256-prefix", hash.as_str());
        assert_eq!("sha256-prefix", hash.to_string());
    }

    #[test]
    fn text_hash_rejects_empty_value() {
        let result = TextHash::new("   ");

        assert_eq!(Err(CommentDomainError::MissingTextHash), result);
    }

    #[test]
    fn text_snippet_accepts_non_empty_value_without_trimming() {
        let snippet = TextSnippet::new("  selected text  ").expect("snippet should be valid");

        assert_eq!("  selected text  ", snippet.as_str());
    }

    #[test]
    fn text_snippet_rejects_empty_value() {
        let result = TextSnippet::new("   ");

        assert_eq!(Err(CommentDomainError::MissingTextSnippet), result);
    }

    #[test]
    fn char_range_accepts_ordered_start_and_end() {
        let range = CharRange::new(4, 17).expect("range should be valid");

        assert_eq!(4, range.start());
        assert_eq!(17, range.end());
        assert_eq!(13, range.len());
        assert!(!range.is_empty());
    }

    #[test]
    fn char_range_accepts_empty_range() {
        let range = CharRange::new(4, 4).expect("range should be valid");

        assert!(range.is_empty());
    }

    #[test]
    fn char_range_rejects_end_before_start() {
        let result = CharRange::new(17, 4);

        assert_eq!(
            Err(CommentDomainError::InvalidCharRange { start: 17, end: 4 }),
            result
        );
    }

    #[test]
    fn comment_anchor_keeps_document_location_and_matching_text() {
        let anchor = anchor_for_file(SpecFileKey::Tasks);

        assert_eq!(SpecFileKey::Tasks, anchor.file_key());
        assert_eq!(BlockType::Paragraph, anchor.block_type());
        assert_eq!(2, anchor.block_index().value());
        assert_eq!("block-hash", anchor.text_hash().as_str());
        assert_eq!("Selected text", anchor.text_snippet().as_str());
        assert_eq!(
            CharRange::new(4, 17).expect("range should be valid"),
            anchor.char_range()
        );
    }

    #[test]
    fn comment_anchor_can_be_created_from_markdown_block_metadata() {
        let block = MarkdownBlock::new(
            MarkdownBlockType::ListItem,
            MarkdownBlockIndex::new(4),
            MarkdownBlockText::new("- [x] Finish task", "Finish task")
                .expect("block text should be valid"),
            MarkdownBlockHash::new("sha256:bd64c9e7").expect("hash should be valid"),
            Some(MarkdownBlockSourceRange::new(12, 29).expect("range should be valid")),
        );

        let anchor = CommentAnchor::from_markdown_block(
            SpecFileKey::Tasks,
            &block,
            TextSnippet::new("Finish").expect("snippet should be valid"),
            CharRange::new(0, 6).expect("range should be valid"),
        )
        .expect("anchor should be valid");

        assert_eq!(SpecFileKey::Tasks, anchor.file_key());
        assert_eq!(BlockType::ListItem, anchor.block_type());
        assert_eq!(4, anchor.block_index().value());
        assert_eq!("sha256:bd64c9e7", anchor.text_hash().as_str());
        assert_eq!("Finish", anchor.text_snippet().as_str());
        assert_eq!(
            CharRange::new(0, 6).expect("range should be valid"),
            anchor.char_range()
        );
    }

    #[test]
    fn comment_starts_open_with_anchor_body_and_timestamps() {
        let created_at = timestamp(1);
        let updated_at = timestamp(2);
        let comment = Comment::new(
            CommentId::new("comment-1").expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Looks good").expect("body should be valid"),
            created_at,
            updated_at,
        )
        .expect("comment should be valid");

        assert_eq!("comment-1", comment.id().as_str());
        assert_eq!(SpecFileKey::Impl, comment.anchor().file_key());
        assert_eq!("Looks good", comment.body().as_str());
        assert_eq!(CommentStatus::Open, comment.status());
        assert!(!comment.is_resolved());
        assert_eq!(created_at, comment.created_at());
        assert_eq!(updated_at, comment.updated_at());
    }

    #[test]
    fn comment_restores_existing_status() {
        let comment = Comment::restore(
            CommentId::new("comment-1").expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Done").expect("body should be valid"),
            CommentStatus::Resolved,
            timestamp(1),
            timestamp(2),
        )
        .expect("comment should be valid");

        assert_eq!(CommentStatus::Resolved, comment.status());
        assert!(comment.is_resolved());
    }

    #[test]
    fn comment_restore_rejects_updated_timestamp_before_created_timestamp() {
        let result = Comment::restore(
            CommentId::new("comment-1").expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Done").expect("body should be valid"),
            CommentStatus::Resolved,
            timestamp(2),
            timestamp(1),
        );

        assert_eq!(Err(CommentDomainError::UpdatedBeforeCreated), result);
    }

    #[test]
    fn comment_rejects_updated_timestamp_before_created_timestamp() {
        let result = Comment::new(
            CommentId::new("comment-1").expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Looks good").expect("body should be valid"),
            timestamp(2),
            timestamp(1),
        );

        assert_eq!(Err(CommentDomainError::UpdatedBeforeCreated), result);
    }

    #[test]
    fn comment_can_update_body_and_resolution_status() {
        let mut comment = comment_with_id("comment-1");

        comment
            .update_body(
                CommentBody::new("Please expand this section.").expect("body should be valid"),
                timestamp(2),
            )
            .expect("update should be valid");
        comment
            .resolve(timestamp(3))
            .expect("resolve should be valid");
        comment
            .reopen(timestamp(4))
            .expect("reopen should be valid");

        assert_eq!("Please expand this section.", comment.body().as_str());
        assert_eq!(CommentStatus::Open, comment.status());
        assert_eq!(timestamp(4), comment.updated_at());
    }

    #[test]
    fn comment_rejects_mutation_timestamp_before_created_timestamp() {
        let mut comment = comment_with_id("comment-1");
        let result = comment.resolve(timestamp(0));

        assert_eq!(Err(CommentDomainError::UpdatedBeforeCreated), result);
    }

    #[test]
    fn comment_rejects_body_update_before_current_updated_timestamp() {
        let mut comment = comment_with_id("comment-1");
        comment
            .update_body(
                CommentBody::new("Latest body").expect("body should be valid"),
                timestamp(3),
            )
            .expect("first update should be valid");

        let result = comment.update_body(
            CommentBody::new("Stale body").expect("body should be valid"),
            timestamp(2),
        );

        assert_eq!(
            Err(CommentDomainError::UpdatedAtRollback {
                current: timestamp(3),
                attempted: timestamp(2),
            }),
            result
        );
        assert_eq!("Latest body", comment.body().as_str());
        assert_eq!(timestamp(3), comment.updated_at());
    }

    #[test]
    fn comment_rejects_resolve_before_current_updated_timestamp() {
        let mut comment = comment_with_id("comment-1");
        comment
            .update_body(
                CommentBody::new("Latest body").expect("body should be valid"),
                timestamp(3),
            )
            .expect("body update should be valid");

        let result = comment.resolve(timestamp(2));

        assert_eq!(
            Err(CommentDomainError::UpdatedAtRollback {
                current: timestamp(3),
                attempted: timestamp(2),
            }),
            result
        );
        assert_eq!(CommentStatus::Open, comment.status());
        assert_eq!(timestamp(3), comment.updated_at());
    }

    #[test]
    fn comment_rejects_reopen_before_current_updated_timestamp() {
        let mut comment = comment_with_id("comment-1");
        comment
            .resolve(timestamp(3))
            .expect("resolve should be valid");

        let result = comment.reopen(timestamp(2));

        assert_eq!(
            Err(CommentDomainError::UpdatedAtRollback {
                current: timestamp(3),
                attempted: timestamp(2),
            }),
            result
        );
        assert_eq!(CommentStatus::Resolved, comment.status());
        assert_eq!(timestamp(3), comment.updated_at());
    }

    #[test]
    fn comment_accepts_body_and_status_updates_at_current_updated_timestamp() {
        let mut comment = comment_with_id("comment-1");

        comment
            .update_body(
                CommentBody::new("Updated body").expect("body should be valid"),
                timestamp(1),
            )
            .expect("equal body update timestamp should be valid");
        comment
            .resolve(timestamp(1))
            .expect("equal resolve timestamp should be valid");
        comment
            .reopen(timestamp(1))
            .expect("equal reopen timestamp should be valid");

        assert_eq!("Updated body", comment.body().as_str());
        assert_eq!(CommentStatus::Open, comment.status());
        assert_eq!(timestamp(1), comment.updated_at());
    }

    #[test]
    fn comment_thread_keeps_root_and_replies() {
        let thread = CommentThread::new(
            comment_with_id("root"),
            vec![comment_with_id("reply-1"), comment_with_id("reply-2")],
        )
        .expect("thread should be valid");

        assert_eq!("root", thread.root().id().as_str());
        assert_eq!(2, thread.replies().len());
        assert_eq!(3, thread.comments().count());
        assert!(!thread.is_resolved());
    }

    #[test]
    fn comment_thread_is_resolved_when_all_comments_are_resolved() {
        let mut root = comment_with_id("root");
        root.resolve(timestamp(2)).expect("resolve should be valid");
        let mut reply = comment_with_id("reply-1");
        reply
            .resolve(timestamp(2))
            .expect("resolve should be valid");

        let thread = CommentThread::new(root, vec![reply]).expect("thread should be valid");

        assert!(thread.is_resolved());
    }

    #[test]
    fn comment_thread_rejects_duplicate_comment_ids() {
        let duplicate = CommentId::new("root").expect("id should be valid");
        let result = CommentThread::new(comment_with_id("root"), vec![comment_with_id("root")]);

        assert_eq!(
            Err(CommentDomainError::DuplicateCommentId { id: duplicate }),
            result
        );
    }
}
