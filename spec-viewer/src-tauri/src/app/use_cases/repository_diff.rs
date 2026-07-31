//! Repository diff orchestration and boundary validation.
use crate::domain::{
    repository::{
        FileReview, IgnoredPage, RepositoryOverview, RepositoryPort, RepositoryPortError,
        RepositoryRelativePath, SnapshotId,
    },
    workspace::{ValidatedRefName, WorkspaceDomainError, WorktreeId},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RepositoryUseCaseError {
    #[error(transparent)]
    InvalidInput(#[from] WorkspaceDomainError),
    #[error("invalid base override")]
    InvalidOverride { override_ref: String },
    #[error("invalid repository value")]
    InvalidRepositoryValue,
    #[error(transparent)]
    Port(#[from] RepositoryPortError),
}
#[derive(Debug, Clone, Default)]
pub struct RepositoryDiffUseCases<Port> {
    port: Port,
}
impl<Port> RepositoryDiffUseCases<Port> {
    pub fn new(port: Port) -> Self {
        Self { port }
    }
}
impl<Port: RepositoryPort> RepositoryDiffUseCases<Port> {
    pub fn load_overview(
        &self,
        raw_worktree: &str,
        raw_override: Option<&str>,
    ) -> Result<RepositoryOverview, RepositoryUseCaseError> {
        let worktree = WorktreeId::new(raw_worktree)?;
        let override_ref = match raw_override {
            Some(value) => Some(ValidatedRefName::parse(value).map_err(|_| {
                RepositoryUseCaseError::InvalidOverride {
                    override_ref: value.to_string(),
                }
            })?),
            None => None,
        };
        self.port
            .load_overview(&worktree, override_ref.as_ref())
            .map_err(Into::into)
    }
    pub fn traverse_ignored(
        &self,
        raw_worktree: &str,
        raw_snapshot: &str,
        raw_node_id: &str,
        cursor: Option<&str>,
    ) -> Result<IgnoredPage, RepositoryUseCaseError> {
        let worktree = WorktreeId::new(raw_worktree)?;
        let snapshot = SnapshotId::parse(raw_snapshot)
            .map_err(|_| RepositoryUseCaseError::InvalidRepositoryValue)?;
        self.port
            .traverse_ignored(&worktree, &snapshot, raw_node_id, cursor)
            .map_err(Into::into)
    }
    pub fn load_file(
        &self,
        raw_worktree: &str,
        raw_snapshot: &str,
        raw_path: &str,
    ) -> Result<FileReview, RepositoryUseCaseError> {
        let worktree = WorktreeId::new(raw_worktree)?;
        let snapshot = SnapshotId::parse(raw_snapshot)
            .map_err(|_| RepositoryUseCaseError::InvalidRepositoryValue)?;
        let path = RepositoryRelativePath::parse(raw_path)
            .map_err(|_| RepositoryUseCaseError::InvalidRepositoryValue)?;
        self.port
            .load_file(&worktree, &snapshot, &path)
            .map_err(Into::into)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::repository::*;
    #[derive(Clone)]
    struct Fake;
    impl RepositoryPort for Fake {
        fn load_overview(
            &self,
            _: &WorktreeId,
            _: Option<&ValidatedRefName>,
        ) -> Result<RepositoryOverview, RepositoryPortError> {
            Ok(RepositoryOverview {
                repository_id: RepositoryId::parse(format!("rr1_{}", "0".repeat(64))).unwrap(),
                base: BaseBranchResolution::NeedsSelection {
                    reason: BaseResolutionFailure::NotFound,
                    candidates: vec![],
                },
                base_source: None,
                current_snapshot_id: None,
                changed: vec![],
                changed_tree: vec![],
                all_root: vec![],
                all_paths: vec![],
                warnings: vec![],
                ignored_directories: vec![],
            })
        }
        fn traverse_ignored(
            &self,
            _: &WorktreeId,
            _: &SnapshotId,
            _: &str,
            _: Option<&str>,
        ) -> Result<IgnoredPage, RepositoryPortError> {
            Ok(IgnoredPage {
                node_id: format!("in1_{}", "0".repeat(64)),
                directory: RepositoryRelativePath::parse("generated").unwrap(),
                entries: vec![],
                next_cursor: None,
            })
        }
        fn load_file(
            &self,
            _: &WorktreeId,
            _: &SnapshotId,
            _: &RepositoryRelativePath,
        ) -> Result<FileReview, RepositoryPortError> {
            Err(RepositoryPortError::StaleSnapshot)
        }
    }
    #[test]
    fn validates_override_before_calling_port() {
        let use_cases = RepositoryDiffUseCases::new(Fake);
        assert!(matches!(
            use_cases.load_overview(".", Some("-bad")),
            Err(RepositoryUseCaseError::InvalidOverride { .. })
        ));
    }
    #[test]
    fn preserves_stale_snapshot() {
        let use_cases = RepositoryDiffUseCases::new(Fake);
        let result = use_cases.load_file(".", &format!("rs1_{}", "0".repeat(64)), "src/lib.rs");
        assert!(matches!(
            result,
            Err(RepositoryUseCaseError::Port(
                RepositoryPortError::StaleSnapshot
            ))
        ));
    }
}
