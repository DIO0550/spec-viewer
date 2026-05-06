//! User review run domain concepts.

use std::{fmt, str::FromStr};

use chrono::{DateTime, Utc};
use thiserror::Error;

use crate::domain::{
    comment::CommentId,
    spec::{SpecFileKey, SpecId},
};

pub const USER_REVIEW_MANIFEST_SCHEMA_VERSION: &str = "spec-reviewer.review-run.v1";

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserReviewRunId {
    value: String,
}

impl UserReviewRunId {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(ReviewRunDomainError::MissingReviewRunId);
        }

        if !is_safe_identifier(trimmed) {
            return Err(ReviewRunDomainError::InvalidReviewRunId {
                id: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for UserReviewRunId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UserReviewRunStatus {
    Active,
    InProgress,
    Completed,
    Archived,
}

impl UserReviewRunStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::InProgress => "inProgress",
            Self::Completed => "completed",
            Self::Archived => "archived",
        }
    }

    pub fn can_transition_to(self, next: Self) -> bool {
        match (self, next) {
            (current, next) if current == next => true,
            (Self::Active, Self::InProgress | Self::Completed | Self::Archived) => true,
            (Self::InProgress, Self::Active | Self::Completed | Self::Archived) => true,
            (Self::Completed, Self::Archived) => true,
            (Self::Archived, _) => false,
            _ => false,
        }
    }
}

impl fmt::Display for UserReviewRunStatus {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for UserReviewRunStatus {
    type Err = ReviewRunDomainError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "active" => Ok(Self::Active),
            "inProgress" => Ok(Self::InProgress),
            "completed" => Ok(Self::Completed),
            "archived" => Ok(Self::Archived),
            _ => Err(ReviewRunDomainError::UnsupportedStatus {
                status: value.to_string(),
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UserReviewRunTarget {
    File {
        spec_id: SpecId,
        file_key: SpecFileKey,
    },
    Spec {
        spec_id: SpecId,
    },
}

impl UserReviewRunTarget {
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
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UserReviewExecutionTarget {
    CurrentWorkspace {
        workspace_path: ReviewRunPathValue,
    },
    Worktree {
        repository_path: ReviewRunPathValue,
        worktree_path: ReviewRunPathValue,
        branch_name: ReviewRunBranchName,
    },
}

impl UserReviewExecutionTarget {
    pub fn current_workspace(workspace_path: ReviewRunPathValue) -> UserReviewExecutionTarget {
        Self::CurrentWorkspace { workspace_path }
    }

    pub fn worktree(
        repository_path: ReviewRunPathValue,
        worktree_path: ReviewRunPathValue,
        branch_name: ReviewRunBranchName,
    ) -> UserReviewExecutionTarget {
        Self::Worktree {
            repository_path,
            worktree_path,
            branch_name,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ReviewRunPathValue {
    value: String,
}

impl ReviewRunPathValue {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() || trimmed.contains('\0') {
            return Err(ReviewRunDomainError::InvalidPathValue {
                path: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for ReviewRunPathValue {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ReviewRunBranchName {
    value: String,
}

impl ReviewRunBranchName {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty()
            || trimmed.starts_with('/')
            || trimmed.ends_with('/')
            || trimmed.contains('\\')
            || trimmed.contains('\0')
            || trimmed.contains("..")
        {
            return Err(ReviewRunDomainError::InvalidBranchName {
                branch_name: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn for_run(id: &UserReviewRunId) -> Self {
        Self {
            value: format!("spec-reviewer/{id}"),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for ReviewRunBranchName {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ReviewRunRelativePath {
    value: String,
}

impl ReviewRunRelativePath {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if !is_safe_relative_path(trimmed) {
            return Err(ReviewRunDomainError::InvalidRelativePath {
                path: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for ReviewRunRelativePath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewSourceFile {
    spec_id: SpecId,
    file_key: SpecFileKey,
    relative_path: ReviewRunRelativePath,
}

impl UserReviewSourceFile {
    pub fn new(
        spec_id: SpecId,
        file_key: SpecFileKey,
        relative_path: ReviewRunRelativePath,
    ) -> Self {
        Self {
            spec_id,
            file_key,
            relative_path,
        }
    }

    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn relative_path(&self) -> &ReviewRunRelativePath {
        &self.relative_path
    }
}

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

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ReviewRunDomainError {
    #[error("review run id is required")]
    MissingReviewRunId,
    #[error("review run id is invalid: {id}")]
    InvalidReviewRunId { id: String },
    #[error("review run status is unsupported: {status}")]
    UnsupportedStatus { status: String },
    #[error("review run path is invalid: {path}")]
    InvalidPathValue { path: String },
    #[error("review run branch name is invalid: {branch_name}")]
    InvalidBranchName { branch_name: String },
    #[error("review run relative path is invalid: {path}")]
    InvalidRelativePath { path: String },
    #[error("review run requires at least one source file")]
    MissingSourceFiles,
    #[error("review run requires at least one comment id")]
    MissingCommentIds,
    #[error("archived review run requires archived timestamp")]
    MissingArchivedAt,
    #[error("review run archived timestamp cannot be before created timestamp")]
    ArchivedBeforeCreated,
    #[error("review run status cannot transition from {current} to {next}")]
    InvalidStatusTransition {
        current: UserReviewRunStatus,
        next: UserReviewRunStatus,
    },
}

fn is_safe_identifier(value: &str) -> bool {
    value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
}

fn is_safe_relative_path(value: &str) -> bool {
    if value.is_empty()
        || value.contains('\\')
        || value.contains('\0')
        || value.starts_with('/')
        || value
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return false;
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-06T00:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn source_file() -> UserReviewSourceFile {
        UserReviewSourceFile::new(
            SpecId::new("001-checkout-flow").expect("spec id should be valid"),
            SpecFileKey::Requirements,
            ReviewRunRelativePath::new(
                ".plugin-workspace/.specs/001-checkout-flow/requirements.md",
            )
            .expect("relative path should be valid"),
        )
    }

    fn active_run() -> UserReviewRun {
        UserReviewRun::restore(
            UserReviewRunId::new("2026-05-06T120000Z-file-requirements")
                .expect("id should be valid"),
            UserReviewRunStatus::Active,
            UserReviewRunTarget::file(
                SpecId::new("001-checkout-flow").expect("spec id should be valid"),
                SpecFileKey::Requirements,
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
    fn review_run_id_accepts_safe_human_readable_values() {
        let id = UserReviewRunId::new("  2026-05-06T120000Z-file-requirements  ")
            .expect("id should be valid");

        assert_eq!("2026-05-06T120000Z-file-requirements", id.as_str());
    }

    #[test]
    fn review_run_id_rejects_empty_and_path_like_values() {
        for value in [" ", "../escape", "nested/run", "bad\\run", "bad\0run"] {
            let result = UserReviewRunId::new(value);

            assert!(result.is_err());
        }
    }

    #[test]
    fn status_parses_manifest_values() {
        assert_eq!(
            Ok(UserReviewRunStatus::Active),
            UserReviewRunStatus::from_str("active")
        );
        assert_eq!(
            Ok(UserReviewRunStatus::InProgress),
            UserReviewRunStatus::from_str("inProgress")
        );
        assert_eq!(
            Err(ReviewRunDomainError::UnsupportedStatus {
                status: "ready".to_string()
            }),
            UserReviewRunStatus::from_str("ready")
        );
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

    #[test]
    fn worktree_execution_target_can_store_branch_metadata() {
        let id = UserReviewRunId::new("2026-05-06T120000Z-file-requirements")
            .expect("id should be valid");
        let execution_target = UserReviewExecutionTarget::worktree(
            ReviewRunPathValue::new("/workspace/project").expect("path should be valid"),
            ReviewRunPathValue::new("/workspace/project-worktrees/review")
                .expect("path should be valid"),
            ReviewRunBranchName::for_run(&id),
        );

        assert_eq!(
            UserReviewExecutionTarget::Worktree {
                repository_path: ReviewRunPathValue::new("/workspace/project")
                    .expect("path should be valid"),
                worktree_path: ReviewRunPathValue::new("/workspace/project-worktrees/review")
                    .expect("path should be valid"),
                branch_name: ReviewRunBranchName::new(
                    "spec-reviewer/2026-05-06T120000Z-file-requirements"
                )
                .expect("branch should be valid"),
            },
            execution_target
        );
    }

    #[test]
    fn relative_source_paths_reject_traversal_and_absolute_paths() {
        for value in [
            "",
            "../requirements.md",
            "/tmp/requirements.md",
            "spec/../tasks.md",
        ] {
            let result = ReviewRunRelativePath::new(value);

            assert!(matches!(
                result,
                Err(ReviewRunDomainError::InvalidRelativePath { .. })
            ));
        }
    }
}
