//! Review run execution target.

use crate::domain::review_run::{ReviewRunBranchName, ReviewRunPathValue};

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

    /// Returns the workspace path where the review run is executed.
    pub fn workspace_path(&self) -> &str {
        match self {
            Self::CurrentWorkspace { workspace_path } => workspace_path.as_str(),
            Self::Worktree { worktree_path, .. } => worktree_path.as_str(),
        }
    }

    /// Renders a short human-readable description of the execution target.
    pub fn describe(&self) -> String {
        match self {
            Self::CurrentWorkspace { workspace_path } => {
                format!("currentWorkspace / {}", workspace_path.as_str())
            }
            Self::Worktree {
                worktree_path,
                branch_name,
                ..
            } => format!(
                "worktree / {} / {}",
                worktree_path.as_str(),
                branch_name.as_str()
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::review_run::UserReviewRunId;

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
}
