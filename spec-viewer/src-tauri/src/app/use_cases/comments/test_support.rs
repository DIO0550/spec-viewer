//! Shared fakes and builders for comment use case tests.

use std::{cell::RefCell, rc::Rc};

use chrono::{DateTime, Utc};

use crate::{
    app::use_cases::AppUseCaseError,
    domain::{
        comment::{
            BlockIndex, BlockType, CharRange, Comment, CommentAnchor, CommentBody, CommentId,
            CommentListQuery, CommentRepository, CommentRepositoryError, CommentScope,
            CommentStatus, TextHash, TextSnippet,
        },
        spec::{
            MarkdownBlock, MarkdownBlockHash, MarkdownBlockIndex, MarkdownBlockText,
            MarkdownBlockType, SpecFileKey,
        },
    },
};

use super::{CommentUseCases, GenerateCommentId, GetCurrentTime};

#[derive(Debug, Clone, Default)]
pub(crate) struct FakeCommentRepository {
    pub(crate) comments: Rc<RefCell<Vec<Comment>>>,
}

impl CommentRepository for FakeCommentRepository {
    fn list(&self, query: &CommentListQuery) -> Result<Vec<Comment>, CommentRepositoryError> {
        Ok(self
            .comments
            .borrow()
            .iter()
            .filter(|comment| query.includes(comment))
            .cloned()
            .collect())
    }

    fn add(
        &self,
        scope: &CommentScope,
        comment: Comment,
    ) -> Result<Comment, CommentRepositoryError> {
        if !scope.contains_comment(&comment) {
            return Err(CommentRepositoryError::scope_mismatch(
                scope.file_key(),
                comment.anchor().file_key(),
            ));
        }

        if self
            .comments
            .borrow()
            .iter()
            .any(|existing| existing.id() == comment.id())
        {
            return Err(CommentRepositoryError::duplicate(comment.id().clone()));
        }

        self.comments.borrow_mut().push(comment.clone());

        Ok(comment)
    }

    fn update(
        &self,
        scope: &CommentScope,
        comment: Comment,
    ) -> Result<Comment, CommentRepositoryError> {
        if !scope.contains_comment(&comment) {
            return Err(CommentRepositoryError::scope_mismatch(
                scope.file_key(),
                comment.anchor().file_key(),
            ));
        }

        let mut comments = self.comments.borrow_mut();
        let existing = comments
            .iter_mut()
            .find(|existing| existing.id() == comment.id())
            .ok_or_else(|| CommentRepositoryError::not_found(comment.id().clone()))?;

        *existing = comment.clone();

        Ok(comment)
    }

    fn delete(&self, _scope: &CommentScope, id: &CommentId) -> Result<(), CommentRepositoryError> {
        let mut comments = self.comments.borrow_mut();
        let initial_len = comments.len();
        comments.retain(|comment| comment.id() != id);

        if comments.len() == initial_len {
            return Err(CommentRepositoryError::not_found(id.clone()));
        }

        Ok(())
    }
}

#[derive(Debug, Clone)]
pub(crate) struct FakeIdGenerator {
    pub(crate) id: CommentId,
}

impl GenerateCommentId for FakeIdGenerator {
    fn generate_comment_id(&self) -> Result<CommentId, AppUseCaseError> {
        Ok(self.id.clone())
    }
}

#[derive(Debug, Clone)]
pub(crate) struct FakeClock {
    pub(crate) now: DateTime<Utc>,
}

impl GetCurrentTime for FakeClock {
    fn now(&self) -> DateTime<Utc> {
        self.now
    }
}

#[derive(Debug, Clone)]
pub(crate) struct FailingCommentRepository {
    pub(crate) message: String,
}

impl CommentRepository for FailingCommentRepository {
    fn list(&self, _query: &CommentListQuery) -> Result<Vec<Comment>, CommentRepositoryError> {
        Err(CommentRepositoryError::invalid_data(self.message.clone()))
    }

    fn add(
        &self,
        _scope: &CommentScope,
        _comment: Comment,
    ) -> Result<Comment, CommentRepositoryError> {
        unreachable!("failing repository is only used for list")
    }

    fn update(
        &self,
        _scope: &CommentScope,
        _comment: Comment,
    ) -> Result<Comment, CommentRepositoryError> {
        unreachable!("failing repository is only used for list")
    }

    fn delete(&self, _scope: &CommentScope, _id: &CommentId) -> Result<(), CommentRepositoryError> {
        unreachable!("failing repository is only used for list")
    }
}

pub(crate) fn use_cases(
    repository: FakeCommentRepository,
) -> CommentUseCases<FakeCommentRepository, FakeIdGenerator, FakeClock> {
    CommentUseCases::new(
        repository,
        FakeIdGenerator {
            id: CommentId::new("cmt_generated").expect("comment id should be valid"),
        },
        FakeClock { now: timestamp(5) },
    )
}

pub(crate) fn timestamp(second: u32) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&format!("2026-05-05T12:00:{second:02}Z"))
        .expect("timestamp should parse")
        .with_timezone(&Utc)
}

pub(crate) fn anchor(file_key: SpecFileKey) -> CommentAnchor {
    anchor_with(
        file_key,
        BlockType::Paragraph,
        2,
        "sha256_prefix_8chars",
        "selected text",
    )
}

pub(crate) fn anchor_with(
    file_key: SpecFileKey,
    block_type: BlockType,
    block_index: usize,
    text_hash: &str,
    text_snippet: &str,
) -> CommentAnchor {
    CommentAnchor::new(
        file_key,
        block_type,
        BlockIndex::new(block_index),
        TextHash::new(text_hash).expect("hash should be valid"),
        TextSnippet::new(text_snippet).expect("snippet should be valid"),
        CharRange::new(3, 16).expect("range should be valid"),
    )
}

pub(crate) fn comment(
    id: &str,
    file_key: SpecFileKey,
    body: &str,
    status: CommentStatus,
    updated_second: u32,
) -> Comment {
    Comment::restore(
        CommentId::new(id).expect("comment id should be valid"),
        anchor(file_key),
        CommentBody::new(body).expect("body should be valid"),
        status,
        timestamp(1),
        timestamp(updated_second),
    )
    .expect("comment should be valid")
}

pub(crate) fn comment_with_anchor(id: &str, anchor: CommentAnchor) -> Comment {
    Comment::restore(
        CommentId::new(id).expect("comment id should be valid"),
        anchor,
        CommentBody::new("Body").expect("body should be valid"),
        CommentStatus::Open,
        timestamp(1),
        timestamp(1),
    )
    .expect("comment should be valid")
}

pub(crate) fn markdown_block(
    block_type: MarkdownBlockType,
    index: usize,
    raw: &str,
    normalized: &str,
    text_hash: &str,
) -> MarkdownBlock {
    MarkdownBlock::new(
        block_type,
        MarkdownBlockIndex::new(index),
        MarkdownBlockText::new(raw, normalized).expect("block text should be valid"),
        MarkdownBlockHash::new(text_hash).expect("block hash should be valid"),
        None,
    )
}
