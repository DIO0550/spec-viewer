//! Tauri command handlers and DTOs.

pub mod comments;
pub mod repository;
pub mod specs;
pub mod watch;
pub mod workspace;

use std::sync::Arc;

use crate::app::{
    services::file_watching::FileWatchManager,
    use_cases::{repository_diff::RepositoryDiffUseCases, FilesystemAppUseCases},
};
use crate::infrastructure::git::GitRepositoryAdapter;

#[derive(Debug, Clone, Default)]
pub struct CommandState {
    use_cases: FilesystemAppUseCases,
    file_watch_manager: Arc<FileWatchManager>,
    repository_use_cases: RepositoryDiffUseCases<GitRepositoryAdapter>,
}
impl CommandState {
    pub fn new(use_cases: FilesystemAppUseCases) -> Self {
        Self {
            use_cases,
            file_watch_manager: Arc::new(FileWatchManager::new()),
            repository_use_cases: RepositoryDiffUseCases::new(GitRepositoryAdapter::default()),
        }
    }

    pub fn use_cases(&self) -> &FilesystemAppUseCases {
        &self.use_cases
    }

    pub fn repository_use_cases(&self) -> &RepositoryDiffUseCases<GitRepositoryAdapter> {
        &self.repository_use_cases
    }

    pub fn file_watch_manager(&self) -> &FileWatchManager {
        &self.file_watch_manager
    }
}
