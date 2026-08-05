//! Spec-scoped working-tree diff orchestration.

use std::{
    collections::{BTreeMap, BTreeSet},
    error::Error,
    fmt,
    str::FromStr,
};

use crate::domain::{
    repository::{
        CommitSha, ComparisonRevision, DiffFile, FileChangeKind, FileReview, RepositoryPortError,
        RepositoryRelativePath, RevisionOption, SnapshotId, SpecFileHistory, WorkingTreeDiffPort,
    },
    spec::{SpecFileKey, SpecId},
    workspace::WorktreeId,
};

type SpecIdentity = (SpecId, SpecFileKey);

const SPEC_FILE_HISTORY_LIMIT: usize = 50;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecDiffTarget {
    spec_id: SpecId,
    file_key: SpecFileKey,
    candidate_paths: Vec<RepositoryRelativePath>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpecDiffTargetInvariantError {
    MissingCandidatePath {
        spec_id: SpecId,
        file_key: SpecFileKey,
    },
    DuplicateIdentity {
        spec_id: SpecId,
        file_key: SpecFileKey,
    },
    AmbiguousCandidatePath {
        path: RepositoryRelativePath,
    },
}

impl fmt::Display for SpecDiffTargetInvariantError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingCandidatePath { spec_id, file_key } => write!(
                formatter,
                "Spec diff target has no candidate path: {}/{file_key:?}",
                spec_id.as_str()
            ),
            Self::DuplicateIdentity { spec_id, file_key } => write!(
                formatter,
                "Spec diff target identity is duplicated: {}/{file_key:?}",
                spec_id.as_str()
            ),
            Self::AmbiguousCandidatePath { path } => write!(
                formatter,
                "Spec diff candidate path maps to multiple identities: {}",
                path.as_str()
            ),
        }
    }
}

impl Error for SpecDiffTargetInvariantError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSpecDiffTargets {
    worktree: WorktreeId,
    targets: Vec<SpecDiffTarget>,
    identities_by_path: BTreeMap<RepositoryRelativePath, SpecIdentity>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SpecDiffProjectionError {
    ConflictingRenameTargets,
}

pub trait ResolveSpecDiffTargets {
    type Error: Error + Send + Sync + 'static;

    fn resolve(&self, workspace_path: &str) -> Result<ResolvedSpecDiffTargets, Self::Error>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChangedSpecFile {
    pub spec_id: SpecId,
    pub file_key: SpecFileKey,
    pub target_path: RepositoryRelativePath,
    pub old_path: Option<RepositoryRelativePath>,
    pub new_path: Option<RepositoryRelativePath>,
    pub change: FileChangeKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChangedSpecFiles {
    pub resolved_base_sha: CommitSha,
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
        comparison: ComparisonRevision,
    ) -> Result<ChangedSpecFiles, SpecDiffUseCaseError<Targets::Error>> {
        let resolved = self
            .targets
            .resolve(workspace_path)
            .map_err(SpecDiffUseCaseError::Target)?;
        let overview = self
            .git
            .load_working_tree_overview(resolved.worktree(), &comparison)?;
        let files = resolved
            .project_changed_files(&overview.changed)
            .map_err(|_| SpecDiffUseCaseError::ConflictingRenameTargets)?;

        Ok(ChangedSpecFiles {
            resolved_base_sha: overview.resolved_base_sha,
            current_snapshot_id: overview.current_snapshot_id,
            files,
        })
    }

    pub fn list_spec_diff_revisions(
        &self,
        workspace_path: &str,
    ) -> Result<Vec<RevisionOption>, SpecDiffUseCaseError<Targets::Error>> {
        let resolved = self
            .targets
            .resolve(workspace_path)
            .map_err(SpecDiffUseCaseError::Target)?;
        self.git
            .list_comparison_revisions(resolved.worktree())
            .map_err(SpecDiffUseCaseError::Repository)
    }

    pub fn list_spec_file_commit_history(
        &self,
        workspace_path: &str,
        spec_id: &str,
        file_key: &str,
        path: &str,
    ) -> Result<SpecFileHistory, SpecDiffUseCaseError<Targets::Error>> {
        let resolved = self
            .targets
            .resolve(workspace_path)
            .map_err(SpecDiffUseCaseError::Target)?;
        let requested_key =
            SpecFileKey::from_str(file_key).map_err(|_| SpecDiffUseCaseError::InvalidInput)?;
        let requested_path =
            RepositoryRelativePath::parse(path).map_err(|_| SpecDiffUseCaseError::InvalidInput)?;
        let target = resolved
            .find_target(spec_id, requested_key)
            .ok_or(SpecDiffUseCaseError::InvalidInput)?;
        if !target.accepts(&requested_path) {
            return Err(SpecDiffUseCaseError::InvalidInput);
        }
        self.git
            .list_file_history(
                resolved.worktree(),
                &requested_path,
                SPEC_FILE_HISTORY_LIMIT,
            )
            .map_err(SpecDiffUseCaseError::Repository)
    }

    pub fn get_spec_file_diff(
        &self,
        workspace_path: &str,
        snapshot_id: &str,
        resolved_base_sha: Option<&str>,
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

        if !target.accepts(&requested_path) {
            return Err(SpecDiffUseCaseError::InvalidInput);
        }

        let resolved_base = match resolved_base_sha {
            Some(value) => {
                CommitSha::parse(value).map_err(|_| SpecDiffUseCaseError::InvalidInput)?
            }
            None => {
                self.git
                    .load_working_tree_overview(resolved.worktree(), &ComparisonRevision::Head)?
                    .resolved_base_sha
            }
        };
        let review = self.git.load_working_tree_file(
            resolved.worktree(),
            &snapshot,
            &resolved_base,
            &requested_path,
        )?;

        Ok(SpecFileDiff {
            spec_id: target.spec_id().clone(),
            file_key: target.file_key(),
            review,
        })
    }
}

impl SpecDiffTarget {
    pub fn new(
        spec_id: SpecId,
        file_key: SpecFileKey,
        mut candidate_paths: Vec<RepositoryRelativePath>,
    ) -> Result<Self, SpecDiffTargetInvariantError> {
        if candidate_paths.is_empty() {
            return Err(SpecDiffTargetInvariantError::MissingCandidatePath { spec_id, file_key });
        }
        candidate_paths.sort();
        candidate_paths.dedup();
        Ok(Self {
            spec_id,
            file_key,
            candidate_paths,
        })
    }

    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn candidate_paths(&self) -> &[RepositoryRelativePath] {
        &self.candidate_paths
    }

    fn identity(&self) -> SpecIdentity {
        (self.spec_id.clone(), self.file_key)
    }

    fn accepts(&self, path: &RepositoryRelativePath) -> bool {
        self.candidate_paths.binary_search(path).is_ok()
    }
}

impl ResolvedSpecDiffTargets {
    pub fn new(
        worktree: WorktreeId,
        mut targets: Vec<SpecDiffTarget>,
    ) -> Result<Self, SpecDiffTargetInvariantError> {
        targets.sort_by(|left, right| {
            left.spec_id
                .as_str()
                .cmp(right.spec_id.as_str())
                .then_with(|| left.file_key.cmp(&right.file_key))
        });
        let mut logical_identities = BTreeSet::<(String, SpecFileKey)>::new();
        let mut identities_by_path = BTreeMap::new();
        for target in &targets {
            let logical_identity = (target.spec_id.as_str().to_string(), target.file_key);
            if !logical_identities.insert(logical_identity) {
                return Err(SpecDiffTargetInvariantError::DuplicateIdentity {
                    spec_id: target.spec_id().clone(),
                    file_key: target.file_key(),
                });
            }
            for path in &target.candidate_paths {
                let identity = target.identity();
                if identities_by_path
                    .insert(path.clone(), identity.clone())
                    .is_some_and(|existing| existing != identity)
                {
                    return Err(SpecDiffTargetInvariantError::AmbiguousCandidatePath {
                        path: path.clone(),
                    });
                }
            }
        }
        Ok(Self {
            worktree,
            targets,
            identities_by_path,
        })
    }

    pub fn worktree(&self) -> &WorktreeId {
        &self.worktree
    }

    fn find_target(&self, spec_id: &str, file_key: SpecFileKey) -> Option<&SpecDiffTarget> {
        self.targets
            .iter()
            .find(|target| target.spec_id.as_str() == spec_id && target.file_key == file_key)
    }

    fn project_changed_files(
        &self,
        changed: &[DiffFile],
    ) -> Result<Vec<ChangedSpecFile>, SpecDiffProjectionError> {
        let mut projected = BTreeMap::<(String, SpecFileKey), ChangedSpecFile>::new();

        for file in changed {
            let old_identity = file.old_path.as_ref().and_then(|path| {
                self.identities_by_path
                    .get(path)
                    .map(|identity| (identity, path))
            });
            let new_identity = file.new_path.as_ref().and_then(|path| {
                self.identities_by_path
                    .get(path)
                    .map(|identity| (identity, path))
            });
            let (identity, target_path) = match (old_identity, new_identity) {
                (Some((old, _)), Some((new, _))) if old != new => {
                    return Err(SpecDiffProjectionError::ConflictingRenameTargets)
                }
                (_, Some(matched)) | (Some(matched), None) => matched,
                (None, None) => continue,
            };
            let key = (identity.0.as_str().to_string(), identity.1);
            projected.insert(
                key,
                ChangedSpecFile {
                    spec_id: identity.0.clone(),
                    file_key: identity.1,
                    target_path: target_path.clone(),
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

impl ChangedSpecFile {
    fn selected_path(&self) -> Option<&RepositoryRelativePath> {
        self.new_path.as_ref().or(self.old_path.as_ref())
    }
}

#[cfg(test)]
mod tests {
    #[derive(Debug, Clone, Copy)]
    struct StaticTargets;

    impl ResolveSpecDiffTargets for StaticTargets {
        type Error = std::io::Error;

        fn resolve(&self, _workspace_path: &str) -> Result<ResolvedSpecDiffTargets, Self::Error> {
            Ok(resolved(vec![target(
                "001-alpha",
                SpecFileKey::Tasks,
                &["specs/001/tasks.md"],
            )]))
        }
    }

    #[derive(Debug, Clone, Copy)]
    struct UnexpectedGitCall;

    impl WorkingTreeDiffPort for UnexpectedGitCall {
        fn list_comparison_revisions(
            &self,
            _worktree: &WorktreeId,
        ) -> Result<Vec<RevisionOption>, RepositoryPortError> {
            panic!("Git must not be called for invalid detail input")
        }

        fn list_file_history(
            &self,
            _worktree: &WorktreeId,
            _path: &RepositoryRelativePath,
            _limit: usize,
        ) -> Result<SpecFileHistory, RepositoryPortError> {
            panic!("Git must not be called for invalid detail input")
        }

        fn load_working_tree_overview(
            &self,
            _worktree: &WorktreeId,
            _comparison: &ComparisonRevision,
        ) -> Result<crate::domain::repository::WorkingTreeDiffOverview, RepositoryPortError>
        {
            panic!("Git must not be called for invalid detail input")
        }

        fn load_working_tree_file(
            &self,
            _worktree: &WorktreeId,
            _snapshot: &SnapshotId,
            _resolved_base: &CommitSha,
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
                None,
                "001-alpha",
                "tasks",
                "specs/other/tasks.md",
            ),
            Err(SpecDiffUseCaseError::InvalidInput)
        ));
    }
    #[test]
    fn detail_rejects_malformed_resolved_base_before_calling_git() {
        let use_cases = SpecDiffUseCases::new(StaticTargets, UnexpectedGitCall);

        assert!(matches!(
            use_cases.get_spec_file_diff(
                "/repo",
                &format!("rs1_{}", "a".repeat(64)),
                Some("not-a-sha"),
                "001-alpha",
                "tasks",
                "specs/001/tasks.md",
            ),
            Err(SpecDiffUseCaseError::InvalidInput)
        ));
    }

    #[test]
    fn history_rejects_candidate_outside_resolved_target_before_calling_git() {
        let use_cases = SpecDiffUseCases::new(StaticTargets, UnexpectedGitCall);

        assert!(matches!(
            use_cases.list_spec_file_commit_history(
                "/repo",
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
        SpecDiffTarget::new(
            SpecId::new(spec_id).unwrap(),
            key,
            paths
                .iter()
                .map(|path| RepositoryRelativePath::parse(*path).unwrap())
                .collect(),
        )
        .unwrap()
    }

    fn resolved(targets: Vec<SpecDiffTarget>) -> ResolvedSpecDiffTargets {
        ResolvedSpecDiffTargets::new(WorktreeId::new("/repo").unwrap(), targets).unwrap()
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

        let projected = resolved(targets).project_changed_files(&changed).unwrap();

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

        let projected = resolved(targets).project_changed_files(&changed).unwrap();

        assert_eq!(projected.len(), 1);
        assert_eq!(
            projected[0].old_path.as_ref().unwrap().as_str(),
            "specs/001/tasks.md"
        );
        assert_eq!(
            projected[0].new_path.as_ref().unwrap().as_str(),
            "specs/001/work.md"
        );
        assert_eq!(projected[0].target_path.as_str(), "specs/001/tasks.md");
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
            resolved(targets).project_changed_files(&changed),
            Err(SpecDiffProjectionError::ConflictingRenameTargets)
        ));
    }

    #[test]
    fn ambiguous_candidate_path_is_rejected_before_projection() {
        let targets = vec![
            target("001-alpha", SpecFileKey::Tasks, &["shared/tasks.md"]),
            target("002-beta", SpecFileKey::Tasks, &["shared/tasks.md"]),
        ];

        assert!(matches!(
            ResolvedSpecDiffTargets::new(WorktreeId::new("/repo").unwrap(), targets),
            Err(SpecDiffTargetInvariantError::AmbiguousCandidatePath { .. })
        ));
    }

    #[test]
    fn target_requires_at_least_one_candidate_path() {
        assert!(matches!(
            SpecDiffTarget::new(
                SpecId::new("001-alpha").unwrap(),
                SpecFileKey::Tasks,
                vec![],
            ),
            Err(SpecDiffTargetInvariantError::MissingCandidatePath { .. })
        ));
    }

    #[test]
    fn target_normalizes_candidate_paths_for_membership_checks() {
        let target = target(
            "001-alpha",
            SpecFileKey::Tasks,
            &[
                "specs/001/tasks.html",
                "specs/001/tasks.md",
                "specs/001/tasks.md",
            ],
        );

        assert_eq!(target.candidate_paths().len(), 2);
        assert!(target.accepts(&RepositoryRelativePath::parse("specs/001/tasks.md").unwrap()));
    }

    #[test]
    fn resolved_targets_reject_duplicate_logical_identity() {
        let targets = vec![
            target("001-alpha", SpecFileKey::Tasks, &["specs/a/tasks.md"]),
            target("001-alpha", SpecFileKey::Tasks, &["specs/b/tasks.md"]),
        ];

        assert!(matches!(
            ResolvedSpecDiffTargets::new(WorktreeId::new("/repo").unwrap(), targets),
            Err(SpecDiffTargetInvariantError::DuplicateIdentity { .. })
        ));
    }
}
