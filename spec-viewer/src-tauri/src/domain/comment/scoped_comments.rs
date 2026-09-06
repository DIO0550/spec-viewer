//! Aggregate that owns the comments persisted for one logical spec file.

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use thiserror::Error;

use crate::domain::spec::SpecFileKey;

use super::{repository::CommentScope, Comment, CommentId};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopedComments {
    scope: CommentScope,
    comments: Vec<Comment>,
}

impl ScopedComments {
    pub fn restore(
        scope: CommentScope,
        comments: Vec<Comment>,
    ) -> Result<Self, ScopedCommentsError> {
        let mut ids = HashSet::with_capacity(comments.len());

        for comment in &comments {
            ensure_scope_contains(&scope, comment)?;

            if !ids.insert(comment.id().clone()) {
                return Err(ScopedCommentsError::DuplicateComment {
                    id: comment.id().clone(),
                });
            }
        }

        Ok(Self { scope, comments })
    }

    pub fn scope(&self) -> &CommentScope {
        &self.scope
    }

    pub fn comments(&self) -> &[Comment] {
        &self.comments
    }

    pub fn add(&mut self, comment: Comment) -> Result<Comment, ScopedCommentsError> {
        ensure_scope_contains(&self.scope, &comment)?;

        if self
            .comments
            .iter()
            .any(|existing| existing.id() == comment.id())
        {
            return Err(ScopedCommentsError::DuplicateComment {
                id: comment.id().clone(),
            });
        }

        self.comments.push(comment.clone());

        Ok(comment)
    }

    pub fn update(&mut self, comment: Comment) -> Result<Comment, ScopedCommentsError> {
        ensure_scope_contains(&self.scope, &comment)?;

        let existing = self
            .comments
            .iter_mut()
            .find(|existing| existing.id() == comment.id())
            .ok_or_else(|| ScopedCommentsError::CommentNotFound {
                id: comment.id().clone(),
            })?;

        if comment.updated_at() < existing.updated_at() {
            return Err(ScopedCommentsError::StaleUpdate {
                id: comment.id().clone(),
                current: existing.updated_at(),
                attempted: comment.updated_at(),
            });
        }

        *existing = comment.clone();

        Ok(comment)
    }

    pub fn delete(&mut self, id: &CommentId) -> Result<Comment, ScopedCommentsError> {
        let index = self
            .comments
            .iter()
            .position(|comment| comment.id() == id)
            .ok_or_else(|| ScopedCommentsError::CommentNotFound { id: id.clone() })?;

        Ok(self.comments.remove(index))
    }
}

fn ensure_scope_contains(
    scope: &CommentScope,
    comment: &Comment,
) -> Result<(), ScopedCommentsError> {
    if scope.contains_comment(comment) {
        return Ok(());
    }

    Err(ScopedCommentsError::ScopeMismatch {
        expected_file_key: scope.file_key(),
        actual_file_key: comment.anchor().file_key(),
    })
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ScopedCommentsError {
    #[error("duplicate comment id: {id}")]
    DuplicateComment { id: CommentId },
    #[error("comment not found: {id}")]
    CommentNotFound { id: CommentId },
    #[error("comment update {attempted} is older than current timestamp {current} for {id}")]
    StaleUpdate {
        id: CommentId,
        current: DateTime<Utc>,
        attempted: DateTime<Utc>,
    },
    #[error("comment belongs to file {actual_file_key} but scope is {expected_file_key}")]
    ScopeMismatch {
        expected_file_key: SpecFileKey,
        actual_file_key: SpecFileKey,
    },
}
