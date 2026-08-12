//! Tauri command handlers and DTOs.

pub mod comments;
pub mod diff_comments;
pub mod repository;
pub mod spec_diff;
pub mod specs;
pub mod watch;
pub mod workspace;

use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

use crate::app::{
    services::file_watching::FileWatchManager,
    use_cases::{
        diff_comments::DiffCommentUseCases, repository_diff::RepositoryDiffUseCases,
        spec_diff::SpecDiffUseCases, FilesystemAppUseCases,
    },
};
use crate::domain::comment::diff::{CancellationToken, DiffReviewIdentity};
use crate::infrastructure::{
    filesystem::FilesystemSpecDiffTargetResolver, git::GitRepositoryAdapter,
    persistence::diff_comment_backend::FilesystemDiffCommentBackend,
};

#[derive(Debug, Default)]
struct DiffCommentLoadRegistry {
    generation: u64,
    active: BTreeMap<(String, String), (u64, CancellationToken)>,
}

pub type FilesystemSpecDiffUseCases =
    SpecDiffUseCases<FilesystemSpecDiffTargetResolver, GitRepositoryAdapter>;
pub type FilesystemDiffCommentUseCases = DiffCommentUseCases<FilesystemDiffCommentBackend>;

#[derive(Debug, Clone)]
pub struct CommandState {
    use_cases: FilesystemAppUseCases,
    file_watch_manager: Arc<FileWatchManager>,
    repository_use_cases: RepositoryDiffUseCases<GitRepositoryAdapter>,
    spec_diff_use_cases: FilesystemSpecDiffUseCases,
    diff_comment_use_cases: FilesystemDiffCommentUseCases,
    diff_comment_loads: Arc<Mutex<DiffCommentLoadRegistry>>,
}

impl CommandState {
    pub fn new(
        use_cases: FilesystemAppUseCases,
        repository_use_cases: RepositoryDiffUseCases<GitRepositoryAdapter>,
        spec_diff_use_cases: FilesystemSpecDiffUseCases,
        diff_comment_use_cases: FilesystemDiffCommentUseCases,
    ) -> Self {
        Self {
            use_cases,
            file_watch_manager: Arc::new(FileWatchManager::new()),
            repository_use_cases,
            diff_comment_use_cases,
            diff_comment_loads: Arc::new(Mutex::new(DiffCommentLoadRegistry::default())),
            spec_diff_use_cases,
        }
    }

    pub fn use_cases(&self) -> &FilesystemAppUseCases {
        &self.use_cases
    }

    pub fn repository_use_cases(&self) -> &RepositoryDiffUseCases<GitRepositoryAdapter> {
        &self.repository_use_cases
    }

    pub fn spec_diff_use_cases(&self) -> &FilesystemSpecDiffUseCases {
        &self.spec_diff_use_cases
    }

    pub fn diff_comment_use_cases(&self) -> &FilesystemDiffCommentUseCases {
        &self.diff_comment_use_cases
    }

    pub fn begin_diff_comment_load(&self, identity: &DiffReviewIdentity) -> CancellationToken {
        let Ok(mut registry) = self.diff_comment_loads.lock() else {
            let token = CancellationToken::default();
            token.cancel();
            return token;
        };
        registry.generation = registry.generation.wrapping_add(1);
        let generation = registry.generation;
        let key = (
            identity.repository_id().as_str().to_owned(),
            identity.worktree_id().as_str().to_owned(),
        );
        if let Some((_, previous)) = registry.active.remove(&key) {
            previous.cancel();
        }
        let token = CancellationToken::default();
        registry.active.insert(key, (generation, token.clone()));
        token
    }

    pub fn file_watch_manager(&self) -> &FileWatchManager {
        &self.file_watch_manager
    }
}

#[cfg(test)]
mod diff_comment_load_tests {
    use super::*;
    use crate::domain::{
        comment::diff::WorktreeStorageId,
        repository::{CommitSha, RepositoryId, SnapshotId},
    };

    fn identity(snapshot: char) -> DiffReviewIdentity {
        DiffReviewIdentity::new(
            RepositoryId::parse(format!("rr1_{}", "1".repeat(64))).unwrap(),
            WorktreeStorageId::parse(format!("rw1_{}", "2".repeat(64))).unwrap(),
            CommitSha::parse("3".repeat(40)).unwrap(),
            SnapshotId::parse(format!("rs1_{}", snapshot.to_string().repeat(64))).unwrap(),
        )
    }

    #[test]
    fn superseding_same_scope_load_cancels_prior_generation() {
        let git = GitRepositoryAdapter::default();
        let state = CommandState::new(
            FilesystemAppUseCases::default(),
            RepositoryDiffUseCases::new(git.clone()),
            SpecDiffUseCases::new(FilesystemSpecDiffTargetResolver::new(), git.clone()),
            DiffCommentUseCases::new(FilesystemDiffCommentBackend::new(git)),
        );
        let first = state.begin_diff_comment_load(&identity('4'));
        let second = state.begin_diff_comment_load(&identity('5'));
        assert!(first.is_cancelled());
        assert!(!second.is_cancelled());
    }
}
