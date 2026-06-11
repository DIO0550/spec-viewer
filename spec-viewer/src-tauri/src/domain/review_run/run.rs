//! User review run entity.

use chrono::{DateTime, Utc};

use crate::domain::{
    comment::CommentId,
    review_run::{
        ReviewRunDomainError, ReviewRunPathValue, UserReviewExecutionTarget, UserReviewRunId,
        UserReviewRunStatus, UserReviewRunTarget, UserReviewSourceFile,
    },
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewRun {
    id: UserReviewRunId,
    status: UserReviewRunStatus,
    target: UserReviewRunTarget,
    execution_target: UserReviewExecutionTarget,
    spec_folder_path: ReviewRunPathValue,
    source_files: Vec<UserReviewSourceFile>,
    comment_ids: Vec<CommentId>,
    created_at: DateTime<Utc>,
    archived_at: Option<DateTime<Utc>>,
}

impl UserReviewRun {
    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        id: UserReviewRunId,
        status: UserReviewRunStatus,
        target: UserReviewRunTarget,
        execution_target: UserReviewExecutionTarget,
        spec_folder_path: ReviewRunPathValue,
        source_files: Vec<UserReviewSourceFile>,
        comment_ids: Vec<CommentId>,
        created_at: DateTime<Utc>,
        archived_at: Option<DateTime<Utc>>,
    ) -> Result<Self, ReviewRunDomainError> {
        if source_files.is_empty() {
            return Err(ReviewRunDomainError::MissingSourceFiles);
        }

        if comment_ids.is_empty() {
            return Err(ReviewRunDomainError::MissingCommentIds);
        }

        if matches!(status, UserReviewRunStatus::Archived) && archived_at.is_none() {
            return Err(ReviewRunDomainError::MissingArchivedAt);
        }

        if let Some(archived_at) = archived_at {
            if archived_at < created_at {
                return Err(ReviewRunDomainError::ArchivedBeforeCreated);
            }
        }

        Ok(Self {
            id,
            status,
            target,
            execution_target,
            spec_folder_path,
            source_files,
            comment_ids,
            created_at,
            archived_at,
        })
    }

    pub fn transition_to(
        &mut self,
        status: UserReviewRunStatus,
        archived_at: Option<DateTime<Utc>>,
    ) -> Result<(), ReviewRunDomainError> {
        if !self.status.can_transition_to(status) {
            return Err(ReviewRunDomainError::InvalidStatusTransition {
                current: self.status,
                next: status,
            });
        }

        if matches!(status, UserReviewRunStatus::Archived) && archived_at.is_none() {
            return Err(ReviewRunDomainError::MissingArchivedAt);
        }

        if let Some(archived_at) = archived_at {
            if archived_at < self.created_at {
                return Err(ReviewRunDomainError::ArchivedBeforeCreated);
            }
        }

        self.status = status;
        self.archived_at = archived_at;

        Ok(())
    }

    pub fn id(&self) -> &UserReviewRunId {
        &self.id
    }

    pub fn status(&self) -> UserReviewRunStatus {
        self.status
    }

    pub fn target(&self) -> &UserReviewRunTarget {
        &self.target
    }

    pub fn execution_target(&self) -> &UserReviewExecutionTarget {
        &self.execution_target
    }

    pub fn spec_folder_path(&self) -> &ReviewRunPathValue {
        &self.spec_folder_path
    }

    pub fn source_files(&self) -> &[UserReviewSourceFile] {
        &self.source_files
    }

    pub fn comment_ids(&self) -> &[CommentId] {
        &self.comment_ids
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn archived_at(&self) -> Option<DateTime<Utc>> {
        self.archived_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        review_run::ReviewRunRelativePath,
        spec::{SpecFileKey, SpecId},
    };

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-06T00:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn source_file() -> UserReviewSourceFile {
        UserReviewSourceFile::new(
            SpecId::new("001-checkout-flow").expect("spec id should be valid"),
            SpecFileKey::Impl,
            ReviewRunRelativePath::new(
                ".plugin-workspace/.specs/001-checkout-flow/implementation-plan.md",
            )
            .expect("relative path should be valid"),
        )
    }

    fn active_run() -> UserReviewRun {
        UserReviewRun::restore(
            UserReviewRunId::new("2026-05-06T120000Z-file-impl").expect("id should be valid"),
            UserReviewRunStatus::Active,
            UserReviewRunTarget::file(
                SpecId::new("001-checkout-flow").expect("spec id should be valid"),
                SpecFileKey::Impl,
            ),
            UserReviewExecutionTarget::current_workspace(
                ReviewRunPathValue::new("/workspace/project").expect("path should be valid"),
            ),
            ReviewRunPathValue::new(
                "/workspace/project/.plugin-workspace/.specs/001-checkout-flow",
            )
            .expect("path should be valid"),
            vec![source_file()],
            vec![CommentId::new("comment-1").expect("comment id should be valid")],
            timestamp(1),
            None,
        )
        .expect("run should be valid")
    }

    #[test]
    fn status_transition_allows_active_run_to_complete_and_archive() {
        let mut run = active_run();

        run.transition_to(UserReviewRunStatus::Completed, None)
            .expect("completion should be valid");
        run.transition_to(UserReviewRunStatus::Archived, Some(timestamp(2)))
            .expect("archive should be valid");

        assert_eq!(UserReviewRunStatus::Archived, run.status());
        assert_eq!(Some(timestamp(2)), run.archived_at());
    }

    #[test]
    fn status_transition_rejects_leaving_archive() {
        let mut run = active_run();
        run.transition_to(UserReviewRunStatus::Archived, Some(timestamp(2)))
            .expect("archive should be valid");

        let result = run.transition_to(UserReviewRunStatus::Active, None);

        assert_eq!(
            Err(ReviewRunDomainError::InvalidStatusTransition {
                current: UserReviewRunStatus::Archived,
                next: UserReviewRunStatus::Active,
            }),
            result
        );
    }
}
