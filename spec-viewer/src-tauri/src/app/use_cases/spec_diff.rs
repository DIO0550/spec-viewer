//! Spec-scoped working-tree diff orchestration.

use std::{collections::BTreeMap, error::Error, fmt, str::FromStr};

use crate::domain::{
    repository::{
        DiffFile, FileChangeKind, FileReview, RepositoryPortError, RepositoryRelativePath,
        SnapshotId, WorkingTreeDiffPort,
    },
    spec::{SpecFileKey, SpecId},
    workspace::WorktreeId,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecDiffTarget {
    pub spec_id: SpecId,
    pub file_key: SpecFileKey,
    pub candidate_paths: Vec<RepositoryRelativePath>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSpecDiffTargets {
    pub worktree: WorktreeId,
    pub targets: Vec<SpecDiffTarget>,
}

pub trait ResolveSpecDiffTargets {
    type Error: Error + Send + Sync + 'static;

    fn resolve(&self, workspace_path: &str) -> Result<ResolvedSpecDiffTargets, Self::Error>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChangedSpecFile {
    pub spec_id: SpecId,
    pub file_key: SpecFileKey,
    pub old_path: Option<RepositoryRelativePath>,
    pub new_path: Option<RepositoryRelativePath>,
    pub change: FileChangeKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChangedSpecFiles {
    pub current_snapshot_id: SnapshotId,
    pub files: Vec<ChangedSpecFile>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFileDiff {
    pub spec_id: SpecId,
    pub file_key: SpecFileKey,
    pub review: FileReview,
}

#[derive(Debug)]
pub enum SpecDiffUseCaseError<TargetError> {
    Target(TargetError),
    InvalidInput,
    ConflictingRenameTargets,
    Repository(RepositoryPortError),
}

impl<TargetError: fmt::Display> fmt::Display for SpecDiffUseCaseError<TargetError> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Target(error) => write!(formatter, "Spec target resolution failed: {error}"),
            Self::InvalidInput => formatter.write_str("invalid Spec diff request"),
            Self::ConflictingRenameTargets => {
                formatter.write_str("rename maps to different Spec identities")
            }
            Self::Repository(error) => error.fmt(formatter),
        }
    }
}

impl<TargetError: Error + 'static> Error for SpecDiffUseCaseError<TargetError> {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Target(error) => Some(error),
            Self::Repository(error) => Some(error),
            Self::InvalidInput | Self::ConflictingRenameTargets => None,
        }
    }
}

impl<TargetError> From<RepositoryPortError> for SpecDiffUseCaseError<TargetError> {
    fn from(error: RepositoryPortError) -> Self {
        Self::Repository(error)
    }
}

#[derive(Debug, Clone)]
pub struct SpecDiffUseCases<Targets, Git> {
    targets: Targets,
    git: Git,
}

impl<Targets, Git> SpecDiffUseCases<Targets, Git> {
    pub fn new(targets: Targets, git: Git) -> Self {
        Self { targets, git }
    }
}

impl<Targets, Git> SpecDiffUseCases<Targets, Git>
where
    Targets: ResolveSpecDiffTargets,
    Git: WorkingTreeDiffPort,
{
    pub fn list_changed_spec_files(
        &self,
        workspace_path: &str,
    ) -> Result<ChangedSpecFiles, SpecDiffUseCaseError<Targets::Error>> {
        let resolved = self
            .targets
            .resolve(workspace_path)
            .map_err(SpecDiffUseCaseError::Target)?;
        let overview = self.git.load_working_tree_overview(&resolved.worktree)?;
        let target_index = SpecDiffTargetIndex::new::<Targets::Error>(&resolved.targets)?;
        let files = target_index.project::<Targets::Error>(&overview.changed)?;

        Ok(ChangedSpecFiles {
            current_snapshot_id: overview.current_snapshot_id,
            files,
        })
    }

    pub fn get_spec_file_diff(
        &self,
        workspace_path: &str,
        snapshot_id: &str,
        spec_id: &str,
        file_key: &str,
        path: &str,
    ) -> Result<SpecFileDiff, SpecDiffUseCaseError<Targets::Error>> {
        let resolved = self
            .targets
            .resolve(workspace_path)
            .map_err(SpecDiffUseCaseError::Target)?;
        let requested_key =
            SpecFileKey::from_str(file_key).map_err(|_| SpecDiffUseCaseError::InvalidInput)?;
        let requested_path =
            RepositoryRelativePath::parse(path).map_err(|_| SpecDiffUseCaseError::InvalidInput)?;
        let snapshot =
            SnapshotId::parse(snapshot_id).map_err(|_| SpecDiffUseCaseError::InvalidInput)?;
        let target = resolved
            .find_target(spec_id, requested_key)
            .ok_or(SpecDiffUseCaseError::InvalidInput)?;

        if !target.candidate_paths.contains(&requested_path) {
            return Err(SpecDiffUseCaseError::InvalidInput);
        }

        let review =
            self.git
                .load_working_tree_file(&resolved.worktree, &snapshot, &requested_path)?;

        Ok(SpecFileDiff {
            spec_id: target.spec_id.clone(),
            file_key: target.file_key,
            review,
        })
    }
}

type SpecIdentity = (SpecId, SpecFileKey);

impl ResolvedSpecDiffTargets {
    fn find_target(&self, spec_id: &str, file_key: SpecFileKey) -> Option<&SpecDiffTarget> {
        self.targets
            .iter()
            .find(|target| target.spec_id.as_str() == spec_id && target.file_key == file_key)
    }
}

impl ChangedSpecFile {
    fn selected_path(&self) -> Option<&RepositoryRelativePath> {
        self.new_path.as_ref().or(self.old_path.as_ref())
    }
}

struct SpecDiffTargetIndex {
    identities: BTreeMap<RepositoryRelativePath, SpecIdentity>,
}

impl SpecDiffTargetIndex {
    fn new<TargetError>(
        targets: &[SpecDiffTarget],
    ) -> Result<Self, SpecDiffUseCaseError<TargetError>> {
        let mut identities = BTreeMap::new();
        for target in targets {
            for path in &target.candidate_paths {
                let identity = (target.spec_id.clone(), target.file_key);
                if identities
                    .insert(path.clone(), identity.clone())
                    .is_some_and(|existing| existing != identity)
                {
                    return Err(SpecDiffUseCaseError::InvalidInput);
                }
            }
        }
        Ok(Self { identities })
    }

    fn project<TargetError>(
        &self,
        changed: &[DiffFile],
    ) -> Result<Vec<ChangedSpecFile>, SpecDiffUseCaseError<TargetError>> {
        let mut projected = BTreeMap::<(String, SpecFileKey), ChangedSpecFile>::new();

        for file in changed {
            let old_identity = file
                .old_path
                .as_ref()
                .and_then(|path| self.identities.get(path));
            let new_identity = file
                .new_path
                .as_ref()
                .and_then(|path| self.identities.get(path));
            let identity = match (old_identity, new_identity) {
                (Some(old), Some(new)) if old != new => {
                    return Err(SpecDiffUseCaseError::ConflictingRenameTargets)
                }
                (Some(identity), _) | (_, Some(identity)) => identity,
                (None, None) => continue,
            };
            let key = (identity.0.as_str().to_string(), identity.1);
            projected.insert(
                key,
                ChangedSpecFile {
                    spec_id: identity.0.clone(),
                    file_key: identity.1,
                    old_path: file.old_path.clone(),
                    new_path: file.new_path.clone(),
                    change: file.change,
                },
            );
        }

        let mut files = projected.into_values().collect::<Vec<_>>();
        files.sort_by(|left, right| {
            left.spec_id
                .as_str()
                .cmp(right.spec_id.as_str())
                .then_with(|| left.file_key.cmp(&right.file_key))
                .then_with(|| {
                    left.selected_path()
                        .map(RepositoryRelativePath::as_str)
                        .cmp(&right.selected_path().map(RepositoryRelativePath::as_str))
                })
        });
        Ok(files)
    }
}

#[cfg(test)]
mod tests {
    #[derive(Debug, Clone, Copy)]
    struct StaticTargets;

    impl ResolveSpecDiffTargets for StaticTargets {
        type Error = std::io::Error;

        fn resolve(&self, _workspace_path: &str) -> Result<ResolvedSpecDiffTargets, Self::Error> {
            Ok(ResolvedSpecDiffTargets {
                worktree: WorktreeId::new("/repo").unwrap(),
                targets: vec![target(
                    "001-alpha",
                    SpecFileKey::Tasks,
                    &["specs/001/tasks.md"],
                )],
            })
        }
    }

    #[derive(Debug, Clone, Copy)]
    struct UnexpectedGitCall;

    impl WorkingTreeDiffPort for UnexpectedGitCall {
        fn load_working_tree_overview(
            &self,
            _worktree: &WorktreeId,
        ) -> Result<crate::domain::repository::WorkingTreeDiffOverview, RepositoryPortError>
        {
            panic!("Git must not be called for invalid detail input")
        }

        fn load_working_tree_file(
            &self,
            _worktree: &WorktreeId,
            _snapshot: &SnapshotId,
            _path: &RepositoryRelativePath,
        ) -> Result<FileReview, RepositoryPortError> {
            panic!("Git must not be called for invalid detail input")
        }
    }

    #[test]
    fn detail_rejects_unresolved_path_before_calling_git() {
        let use_cases = SpecDiffUseCases::new(StaticTargets, UnexpectedGitCall);

        assert!(matches!(
            use_cases.get_spec_file_diff(
                "/repo",
                &format!("rs1_{}", "a".repeat(64)),
                "001-alpha",
                "tasks",
                "specs/other/tasks.md",
            ),
            Err(SpecDiffUseCaseError::InvalidInput)
        ));
    }
    use super::*;
    use crate::domain::repository::{ContentClassification, EntryKind};

    fn target(spec_id: &str, key: SpecFileKey, paths: &[&str]) -> SpecDiffTarget {
        SpecDiffTarget {
            spec_id: SpecId::new(spec_id).unwrap(),
            file_key: key,
            candidate_paths: paths
                .iter()
                .map(|path| RepositoryRelativePath::parse(*path).unwrap())
                .collect(),
        }
    }

    fn diff(old: Option<&str>, new: Option<&str>, change: FileChangeKind) -> DiffFile {
        DiffFile::new(
            old.map(|path| RepositoryRelativePath::parse(path).unwrap()),
            new.map(|path| RepositoryRelativePath::parse(path).unwrap()),
            change,
            EntryKind::Regular,
            ContentClassification::Text,
            matches!(change, FileChangeKind::Renamed | FileChangeKind::Copied).then_some(100),
            None,
            None,
        )
        .unwrap()
    }

    #[test]
    fn projects_only_spec_changes_in_stable_identity_order() {
        let targets = vec![
            target("002-beta", SpecFileKey::Tasks, &["specs/002/tasks.md"]),
            target(
                "001-alpha",
                SpecFileKey::Impl,
                &["specs/001/implementation-plan.md"],
            ),
        ];
        let changed = vec![
            diff(
                Some("src/lib.rs"),
                Some("src/lib.rs"),
                FileChangeKind::Modified,
            ),
            diff(
                Some("specs/002/tasks.md"),
                Some("specs/002/tasks.md"),
                FileChangeKind::Modified,
            ),
            diff(
                Some("specs/001/implementation-plan.md"),
                Some("specs/001/implementation-plan.md"),
                FileChangeKind::Modified,
            ),
        ];

        let projected = SpecDiffTargetIndex::new::<std::io::Error>(&targets)
            .unwrap()
            .project::<std::io::Error>(&changed)
            .unwrap();

        assert_eq!(projected.len(), 2);
        assert_eq!(projected[0].spec_id.as_str(), "001-alpha");
        assert_eq!(projected[1].spec_id.as_str(), "002-beta");
    }

    #[test]
    fn rename_uses_the_only_matching_identity_and_keeps_both_paths() {
        let targets = vec![target(
            "001-alpha",
            SpecFileKey::Tasks,
            &["specs/001/tasks.md"],
        )];
        let changed = vec![diff(
            Some("specs/001/tasks.md"),
            Some("specs/001/work.md"),
            FileChangeKind::Renamed,
        )];

        let projected = SpecDiffTargetIndex::new::<std::io::Error>(&targets)
            .unwrap()
            .project::<std::io::Error>(&changed)
            .unwrap();

        assert_eq!(projected.len(), 1);
        assert_eq!(
            projected[0].old_path.as_ref().unwrap().as_str(),
            "specs/001/tasks.md"
        );
        assert_eq!(
            projected[0].new_path.as_ref().unwrap().as_str(),
            "specs/001/work.md"
        );
    }

    #[test]
    fn rename_between_different_spec_identities_is_rejected() {
        let targets = vec![
            target("001-alpha", SpecFileKey::Tasks, &["specs/001/tasks.md"]),
            target("002-beta", SpecFileKey::Tasks, &["specs/002/tasks.md"]),
        ];
        let changed = vec![diff(
            Some("specs/001/tasks.md"),
            Some("specs/002/tasks.md"),
            FileChangeKind::Renamed,
        )];

        assert!(matches!(
            SpecDiffTargetIndex::new::<std::io::Error>(&targets)
                .unwrap()
                .project::<std::io::Error>(&changed),
            Err(SpecDiffUseCaseError::ConflictingRenameTargets)
        ));
    }

    #[test]
    fn ambiguous_candidate_path_is_rejected_before_projection() {
        let targets = vec![
            target("001-alpha", SpecFileKey::Tasks, &["shared/tasks.md"]),
            target("002-beta", SpecFileKey::Tasks, &["shared/tasks.md"]),
        ];

        assert!(matches!(
            SpecDiffTargetIndex::new::<std::io::Error>(&targets),
            Err(SpecDiffUseCaseError::InvalidInput)
        ));
    }
}
