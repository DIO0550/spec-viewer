//! Tauri command handlers and DTOs.

pub mod comments;
pub mod repository;
pub mod spec_diff;
pub mod specs;
pub mod watch;
pub mod workspace;

use std::sync::Arc;

use crate::app::{
    services::file_watching::FileWatchManager,
    use_cases::{
        repository_diff::RepositoryDiffUseCases, spec_diff::SpecDiffUseCases, FilesystemAppUseCases,
    },
};
use crate::infrastructure::{
    filesystem::FilesystemSpecDiffTargetResolver, git::GitRepositoryAdapter,
};

pub type FilesystemSpecDiffUseCases =
    SpecDiffUseCases<FilesystemSpecDiffTargetResolver, GitRepositoryAdapter>;

#[derive(Debug, Clone)]
pub struct CommandState {
    use_cases: FilesystemAppUseCases,
    file_watch_manager: Arc<FileWatchManager>,
    repository_use_cases: RepositoryDiffUseCases<GitRepositoryAdapter>,
    spec_diff_use_cases: FilesystemSpecDiffUseCases,
}

impl Default for CommandState {
    fn default() -> Self {
        Self::new(FilesystemAppUseCases::default())
    }
}

impl CommandState {
    pub fn new(use_cases: FilesystemAppUseCases) -> Self {
        let git = GitRepositoryAdapter::default();
        Self {
            use_cases,
            file_watch_manager: Arc::new(FileWatchManager::new()),
            repository_use_cases: RepositoryDiffUseCases::new(git.clone()),
            spec_diff_use_cases: SpecDiffUseCases::new(
                FilesystemSpecDiffTargetResolver::new(),
                git,
            ),
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

    pub fn file_watch_manager(&self) -> &FileWatchManager {
        &self.file_watch_manager
    }
}
