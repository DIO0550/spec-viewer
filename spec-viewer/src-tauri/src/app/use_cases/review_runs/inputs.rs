//! Input types for review run use cases.

use crate::domain::{
    comment::CommentId,
    review_run::{UserReviewRunId, UserReviewRunTarget},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewRunExecutionMode {
    CurrentWorkspace,
    Worktree,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateReviewRunInput {
    target: UserReviewRunTarget,
    comment_ids: Vec<CommentId>,
    execution_mode: ReviewRunExecutionMode,
}

impl CreateReviewRunInput {
    pub fn new(
        target: UserReviewRunTarget,
        comment_ids: Vec<CommentId>,
        execution_mode: ReviewRunExecutionMode,
    ) -> Self {
        Self {
            target,
            comment_ids,
            execution_mode,
        }
    }

    pub fn target(&self) -> &UserReviewRunTarget {
        &self.target
    }

    pub fn comment_ids(&self) -> &[CommentId] {
        &self.comment_ids
    }

    pub fn execution_mode(&self) -> ReviewRunExecutionMode {
        self.execution_mode
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListReviewRunsInput {
    target: UserReviewRunTarget,
}

impl ListReviewRunsInput {
    pub fn new(target: UserReviewRunTarget) -> Self {
        Self { target }
    }

    pub fn target(&self) -> &UserReviewRunTarget {
        &self.target
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveReviewRunInput {
    target: UserReviewRunTarget,
    review_run_id: UserReviewRunId,
}

impl ArchiveReviewRunInput {
    pub fn new(target: UserReviewRunTarget, review_run_id: UserReviewRunId) -> Self {
        Self {
            target,
            review_run_id,
        }
    }

    pub fn target(&self) -> &UserReviewRunTarget {
        &self.target
    }

    pub fn review_run_id(&self) -> &UserReviewRunId {
        &self.review_run_id
    }
}
