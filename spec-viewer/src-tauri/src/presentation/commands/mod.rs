//! Tauri command handlers and DTOs.

pub mod comments;
pub mod specs;
pub mod watch;
pub mod workspace;

use std::sync::Arc;

use crate::app::{services::file_watching::FileWatchManager, use_cases::FilesystemAppUseCases};

#[derive(Debug, Clone, Default)]
pub struct CommandState {
    use_cases: FilesystemAppUseCases,
    file_watch_manager: Arc<FileWatchManager>,
}

impl CommandState {
    pub fn new(use_cases: FilesystemAppUseCases) -> Self {
        Self {
            use_cases,
            file_watch_manager: Arc::new(FileWatchManager::new()),
        }
    }

    pub fn use_cases(&self) -> &FilesystemAppUseCases {
        &self.use_cases
    }

    pub fn file_watch_manager(&self) -> &FileWatchManager {
        &self.file_watch_manager
    }
}
