//! Debounced file watching for the currently selected spec file.

mod plan;
mod watcher;

pub use plan::{
    plan_file_watch, FileWatchPlan, FileWatchScope, FileWatchStrategy, FileWatchTarget,
    FileWatchTargetKind,
};
pub use watcher::{
    FileWatchChange, FileWatchError, FileWatchFailure, FileWatchManager, FileWatchNotification,
    FileWatchRegistration,
};
