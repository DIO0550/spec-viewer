//! Output types for review run use cases.

use crate::domain::review_run::UserReviewRun;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateReviewRunResult {
    review_run: UserReviewRun,
    folder_path: String,
}

impl CreateReviewRunResult {
    pub fn new(review_run: UserReviewRun, folder_path: impl Into<String>) -> Self {
        Self {
            review_run,
            folder_path: folder_path.into(),
        }
    }

    pub fn review_run(&self) -> &UserReviewRun {
        &self.review_run
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListedReviewRun {
    review_run: UserReviewRun,
    folder_path: String,
    summary: Option<String>,
    warnings: Vec<String>,
}

impl ListedReviewRun {
    pub fn new(
        review_run: UserReviewRun,
        folder_path: impl Into<String>,
        summary: Option<String>,
        warnings: Vec<String>,
    ) -> Self {
        Self {
            review_run,
            folder_path: folder_path.into(),
            summary,
            warnings,
        }
    }

    pub fn review_run(&self) -> &UserReviewRun {
        &self.review_run
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }

    pub fn summary(&self) -> Option<&str> {
        self.summary.as_deref()
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListReviewRunsResult {
    active: Vec<ListedReviewRun>,
    archived: Vec<ListedReviewRun>,
    problems: Vec<ReviewRunListProblem>,
}

impl ListReviewRunsResult {
    pub fn new(
        active: Vec<ListedReviewRun>,
        archived: Vec<ListedReviewRun>,
        problems: Vec<ReviewRunListProblem>,
    ) -> Self {
        Self {
            active,
            archived,
            problems,
        }
    }

    pub fn active(&self) -> &[ListedReviewRun] {
        &self.active
    }

    pub fn archived(&self) -> &[ListedReviewRun] {
        &self.archived
    }

    pub fn problems(&self) -> &[ReviewRunListProblem] {
        &self.problems
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunListProblem {
    folder_path: String,
    state: ReviewRunListProblemState,
    message: String,
}

impl ReviewRunListProblem {
    pub fn new(
        folder_path: impl Into<String>,
        state: ReviewRunListProblemState,
        message: impl Into<String>,
    ) -> Self {
        Self {
            folder_path: folder_path.into(),
            state,
            message: message.into(),
        }
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }

    pub fn state(&self) -> ReviewRunListProblemState {
        self.state
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewRunListProblemState {
    Malformed,
    MissingFolder,
}

impl ReviewRunListProblemState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Malformed => "malformed",
            Self::MissingFolder => "missingFolder",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveReviewRunResult {
    review_run: UserReviewRun,
    folder_path: String,
    summary: Option<String>,
    warnings: Vec<String>,
}

impl ArchiveReviewRunResult {
    pub fn new(
        review_run: UserReviewRun,
        folder_path: impl Into<String>,
        summary: Option<String>,
        warnings: Vec<String>,
    ) -> Self {
        Self {
            review_run,
            folder_path: folder_path.into(),
            summary,
            warnings,
        }
    }

    pub fn review_run(&self) -> &UserReviewRun {
        &self.review_run
    }

    pub fn folder_path(&self) -> &str {
        &self.folder_path
    }

    pub fn summary(&self) -> Option<&str> {
        self.summary.as_deref()
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }
}
