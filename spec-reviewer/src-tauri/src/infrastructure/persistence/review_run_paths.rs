//! User review run path resolution.
//!
//! Review runs live under the selected spec folder:
//!
//! ```text
//! <spec-folder>/user-review/active/<review-run-id>/
//! <spec-folder>/user-review/archive/<review-run-id>/
//! ```

use std::path::{Path, PathBuf};

use thiserror::Error;

use crate::{
    domain::{review_run::UserReviewRunId, spec::SpecId, workspace::WorkspaceLayout},
    infrastructure::filesystem::spec_directory_path,
};

pub const USER_REVIEW_DIRECTORY: &str = "user-review";
pub const ACTIVE_REVIEW_RUN_DIRECTORY: &str = "active";
pub const ARCHIVE_REVIEW_RUN_DIRECTORY: &str = "archive";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewRunFolderState {
    Active,
    Archive,
}

impl ReviewRunFolderState {
    pub fn directory_name(self) -> &'static str {
        match self {
            Self::Active => ACTIVE_REVIEW_RUN_DIRECTORY,
            Self::Archive => ARCHIVE_REVIEW_RUN_DIRECTORY,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct ReviewRunPathResolver;

impl ReviewRunPathResolver {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        layout: &WorkspaceLayout,
        spec_id: &SpecId,
        run_id: &UserReviewRunId,
        state: ReviewRunFolderState,
    ) -> Result<ReviewRunPath, ReviewRunPathError> {
        let spec_directory = spec_directory_path(layout, spec_id.as_str()).map_err(|_| {
            ReviewRunPathError::InvalidSpecId {
                spec_id: spec_id.as_str().to_string(),
            }
        })?;
        let user_review_directory = spec_directory.join(USER_REVIEW_DIRECTORY);
        let active_directory = user_review_directory.join(ACTIVE_REVIEW_RUN_DIRECTORY);
        let archive_directory = user_review_directory.join(ARCHIVE_REVIEW_RUN_DIRECTORY);
        let run_directory = user_review_directory
            .join(state.directory_name())
            .join(run_id.as_str());
        let path = ReviewRunPath {
            spec_directory,
            user_review_directory,
            active_directory,
            archive_directory,
            run_directory,
        };

        path.ensure_inside_user_review_directory()?;

        Ok(path)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunPath {
    spec_directory: PathBuf,
    user_review_directory: PathBuf,
    active_directory: PathBuf,
    archive_directory: PathBuf,
    run_directory: PathBuf,
}

impl ReviewRunPath {
    pub fn spec_directory(&self) -> &Path {
        &self.spec_directory
    }

    pub fn user_review_directory(&self) -> &Path {
        &self.user_review_directory
    }

    pub fn active_directory(&self) -> &Path {
        &self.active_directory
    }

    pub fn archive_directory(&self) -> &Path {
        &self.archive_directory
    }

    pub fn run_directory(&self) -> &Path {
        &self.run_directory
    }

    fn ensure_inside_user_review_directory(&self) -> Result<(), ReviewRunPathError> {
        if self.user_review_directory.parent() != Some(self.spec_directory.as_path())
            || self.active_directory.parent() != Some(self.user_review_directory.as_path())
            || self.archive_directory.parent() != Some(self.user_review_directory.as_path())
            || !self.run_directory.starts_with(&self.user_review_directory)
        {
            return Err(ReviewRunPathError::PathEscapesUserReviewDirectory {
                path: display_path(&self.run_directory),
            });
        }

        Ok(())
    }
}

#[derive(Debug, Error)]
pub enum ReviewRunPathError {
    #[error("review run spec id is invalid: {spec_id}")]
    InvalidSpecId { spec_id: String },
    #[error("review run path escapes the selected spec folder: {path}")]
    PathEscapesUserReviewDirectory { path: String },
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use super::*;
    use crate::domain::workspace::{WorkspaceKind, WorkspaceRoot};

    struct TestWorkspace {
        root: PathBuf,
    }

    impl TestWorkspace {
        fn new(root: &str) -> Self {
            Self {
                root: PathBuf::from(root),
            }
        }

        fn root(&self) -> &Path {
            &self.root
        }

        fn layout(&self, kind: WorkspaceKind) -> WorkspaceLayout {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("test workspace root should be valid");

            WorkspaceLayout::new(root, kind)
        }
    }

    #[test]
    fn resolves_active_review_run_under_plugin_workspace_spec_folder() {
        let workspace = TestWorkspace::new("/workspace/project");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let spec_id = SpecId::new("001-checkout-flow").expect("spec id should be valid");
        let run_id = UserReviewRunId::new("2026-05-06T120000Z-file-requirements")
            .expect("run id should be valid");

        let path = ReviewRunPathResolver::new()
            .resolve(&layout, &spec_id, &run_id, ReviewRunFolderState::Active)
            .expect("path should resolve");

        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/001-checkout-flow/user-review/active/2026-05-06T120000Z-file-requirements"),
            path.run_directory()
        );
        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/001-checkout-flow/user-review/archive"),
            path.archive_directory()
        );
    }

    #[test]
    fn resolves_archive_review_run_under_spec_skill_feature_folder() {
        let workspace = TestWorkspace::new("/workspace/project");
        let layout = workspace.layout(WorkspaceKind::SpecSkill);
        let spec_id = SpecId::new("checkout-flow").expect("spec id should be valid");
        let run_id =
            UserReviewRunId::new("2026-05-06T120000Z-spec").expect("run id should be valid");

        let path = ReviewRunPathResolver::new()
            .resolve(&layout, &spec_id, &run_id, ReviewRunFolderState::Archive)
            .expect("path should resolve");

        assert_eq!(
            workspace.root().join(
                ".spec-skill/features/checkout-flow/user-review/archive/2026-05-06T120000Z-spec"
            ),
            path.run_directory()
        );
        assert!(path
            .run_directory()
            .starts_with(path.user_review_directory()));
    }

    #[test]
    fn rejects_spec_ids_that_escape_user_review_root() {
        let workspace = TestWorkspace::new("/workspace/project");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let run_id =
            UserReviewRunId::new("2026-05-06T120000Z-spec").expect("run id should be valid");

        for spec_id in ["../escape", "/tmp/spec", "spec\\path"] {
            let spec_id = SpecId::new(spec_id).expect("spec id domain allows raw identifier");
            let result = ReviewRunPathResolver::new().resolve(
                &layout,
                &spec_id,
                &run_id,
                ReviewRunFolderState::Active,
            );

            assert!(matches!(
                result,
                Err(ReviewRunPathError::InvalidSpecId { .. })
            ));
        }
    }
}
