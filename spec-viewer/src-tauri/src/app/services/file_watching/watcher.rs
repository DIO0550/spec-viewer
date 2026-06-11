//! Runtime watcher that observes planned targets and emits debounced notifications.

use std::{
    collections::{HashSet, VecDeque},
    fmt,
    path::{Path, PathBuf},
    sync::{mpsc, Arc, Mutex},
    thread::{self, JoinHandle},
    time::Duration,
};

use notify::{
    event::AccessKind, Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use thiserror::Error;

use super::plan::{
    FileWatchPlan, FileWatchScope, FileWatchStrategy, FileWatchTarget, FileWatchTargetKind,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileWatchRegistration {
    scope: FileWatchScope,
    strategy: FileWatchStrategy,
    watched_paths: Vec<PathBuf>,
    skipped_paths: Vec<PathBuf>,
    debounce_ms: u64,
}

impl FileWatchRegistration {
    #[cfg(test)]
    pub fn new_for_test(
        scope: FileWatchScope,
        strategy: FileWatchStrategy,
        watched_paths: Vec<PathBuf>,
        skipped_paths: Vec<PathBuf>,
        debounce_ms: u64,
    ) -> Self {
        Self {
            scope,
            strategy,
            watched_paths,
            skipped_paths,
            debounce_ms,
        }
    }

    pub fn scope(&self) -> &FileWatchScope {
        &self.scope
    }

    pub fn strategy(&self) -> FileWatchStrategy {
        self.strategy
    }

    pub fn watched_paths(&self) -> &[PathBuf] {
        &self.watched_paths
    }

    pub fn skipped_paths(&self) -> &[PathBuf] {
        &self.skipped_paths
    }

    pub fn debounce_ms(&self) -> u64 {
        self.debounce_ms
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileWatchNotification {
    Changed(FileWatchChange),
    Error(FileWatchFailure),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileWatchChange {
    scope: FileWatchScope,
    kind: FileWatchTargetKind,
    path: PathBuf,
}

impl FileWatchChange {
    fn new(scope: FileWatchScope, kind: FileWatchTargetKind, path: PathBuf) -> Self {
        Self { scope, kind, path }
    }

    #[cfg(test)]
    pub fn new_for_test(scope: FileWatchScope, kind: FileWatchTargetKind, path: PathBuf) -> Self {
        Self::new(scope, kind, path)
    }

    pub fn scope(&self) -> &FileWatchScope {
        &self.scope
    }

    pub fn kind(&self) -> FileWatchTargetKind {
        self.kind
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileWatchFailure {
    scope: FileWatchScope,
    message: String,
}

impl FileWatchFailure {
    fn new(scope: FileWatchScope, message: impl Into<String>) -> Self {
        Self {
            scope,
            message: message.into(),
        }
    }

    pub fn scope(&self) -> &FileWatchScope {
        &self.scope
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

#[derive(Debug, Error)]
pub enum FileWatchError {
    #[error("file watch target has no parent: {path}")]
    MissingParent { path: String },
    #[error("required file watch parent does not exist: {path}")]
    MissingRequiredParent { path: String },
    #[error("no watchable file parents exist")]
    NoWatchableTargets,
    #[error("failed to create file watcher: {message}")]
    CreateWatcher { message: String },
    #[error("failed to watch file parent: {path}: {message}")]
    WatchPath { path: String, message: String },
}

#[derive(Default)]
pub struct FileWatchManager {
    active: Mutex<Option<ActiveFileWatch>>,
}

impl fmt::Debug for FileWatchManager {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("FileWatchManager")
            .field(
                "has_active_watch",
                &self.active.lock().is_ok_and(|active| active.is_some()),
            )
            .finish()
    }
}

impl FileWatchManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn replace_watch<Emit>(
        &self,
        plan: FileWatchPlan,
        emit: Emit,
    ) -> Result<FileWatchRegistration, FileWatchError>
    where
        Emit: Fn(FileWatchNotification) + Send + Sync + 'static,
    {
        self.stop();

        let watch_paths = Self::select_watch_parent_paths(plan.targets())?;
        let (sender, receiver) = mpsc::channel();
        let callback_sender = sender.clone();
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                let _ = callback_sender.send(RawWatchMessage::Notify(result));
            },
            Config::default(),
        )
        .map_err(|source| FileWatchError::CreateWatcher {
            message: source.to_string(),
        })?;

        for path in &watch_paths.watched_paths {
            watcher
                .watch(path, RecursiveMode::NonRecursive)
                .map_err(|source| FileWatchError::WatchPath {
                    path: display_path(path),
                    message: source.to_string(),
                })?;
        }

        let strategy = plan.strategy();
        let worker_state = DebouncedWatchWorker {
            scope: plan.scope().clone(),
            targets: plan.targets().to_vec(),
            debounce: plan.debounce(),
            emit: Arc::new(emit),
        };
        let worker = thread::spawn(move || {
            worker_state.run(receiver);
        });

        let registration = FileWatchRegistration {
            scope: plan.scope().clone(),
            strategy,
            watched_paths: watch_paths.watched_paths,
            skipped_paths: watch_paths.skipped_paths,
            debounce_ms: plan.debounce_ms(),
        };

        let active = ActiveFileWatch {
            _watcher: watcher,
            sender,
            worker: Some(worker),
        };
        *self.active.lock().expect("file watch state should lock") = Some(active);

        Ok(registration)
    }

    pub fn stop(&self) {
        let active = self
            .active
            .lock()
            .expect("file watch state should lock")
            .take();

        if let Some(active) = active {
            active.stop();
        }
    }

    fn select_watch_parent_paths(
        targets: &[FileWatchTarget],
    ) -> Result<SelectedWatchPaths, FileWatchError> {
        let mut seen = HashSet::new();
        let mut watched_paths = Vec::new();
        let mut skipped_paths = Vec::new();

        for target in targets {
            let parent = target
                .path()
                .parent()
                .ok_or_else(|| FileWatchError::MissingParent {
                    path: display_path(target.path()),
                })?;

            if !parent.exists() {
                if target.is_required() {
                    return Err(FileWatchError::MissingRequiredParent {
                        path: display_path(parent),
                    });
                }

                skipped_paths.push(target.path().to_path_buf());
                continue;
            }

            if seen.insert(parent.to_path_buf()) {
                watched_paths.push(parent.to_path_buf());
            }
        }

        if watched_paths.is_empty() {
            return Err(FileWatchError::NoWatchableTargets);
        }

        Ok(SelectedWatchPaths {
            watched_paths,
            skipped_paths,
        })
    }
}

impl Drop for FileWatchManager {
    fn drop(&mut self) {
        self.stop();
    }
}

struct ActiveFileWatch {
    _watcher: RecommendedWatcher,
    sender: mpsc::Sender<RawWatchMessage>,
    worker: Option<JoinHandle<()>>,
}

impl ActiveFileWatch {
    fn stop(mut self) {
        let _ = self.sender.send(RawWatchMessage::Stop);

        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

enum RawWatchMessage {
    Notify(notify::Result<Event>),
    Stop,
}

struct SelectedWatchPaths {
    watched_paths: Vec<PathBuf>,
    skipped_paths: Vec<PathBuf>,
}

/// Debounces raw notify events into per-target-kind change notifications.
struct DebouncedWatchWorker {
    scope: FileWatchScope,
    targets: Vec<FileWatchTarget>,
    debounce: Duration,
    emit: Arc<dyn Fn(FileWatchNotification) + Send + Sync>,
}

impl DebouncedWatchWorker {
    fn run(&self, receiver: mpsc::Receiver<RawWatchMessage>) {
        while let Ok(message) = receiver.recv() {
            let RawWatchMessage::Notify(result) = message else {
                return;
            };

            let mut pending_changes = match self.collect_changes_or_error(result) {
                Some(changes) if !changes.is_empty() => changes,
                _ => continue,
            };

            loop {
                match receiver.recv_timeout(self.debounce) {
                    Ok(RawWatchMessage::Notify(result)) => {
                        if let Some(changes) = self.collect_changes_or_error(result) {
                            pending_changes.extend(changes);
                        }
                    }
                    Ok(RawWatchMessage::Stop) | Err(mpsc::RecvTimeoutError::Disconnected) => return,
                    Err(mpsc::RecvTimeoutError::Timeout) => break,
                }
            }

            self.emit_pending_changes(pending_changes);
        }
    }

    fn collect_changes_or_error(
        &self,
        result: notify::Result<Event>,
    ) -> Option<Vec<FileWatchTargetKind>> {
        match result {
            Ok(event) => Some(Self::matching_target_kinds(&event, &self.targets)),
            Err(source) => {
                (self.emit)(FileWatchNotification::Error(FileWatchFailure::new(
                    self.scope.clone(),
                    source.to_string(),
                )));
                None
            }
        }
    }

    fn emit_pending_changes(&self, changes: Vec<FileWatchTargetKind>) {
        let mut remaining = VecDeque::from(changes);
        let mut emitted = HashSet::new();

        while let Some(kind) = remaining.pop_front() {
            if !emitted.insert(kind) {
                continue;
            }

            (self.emit)(FileWatchNotification::Changed(FileWatchChange::new(
                self.scope.clone(),
                kind,
                self.path_for_kind(kind),
            )));
        }
    }

    fn path_for_kind(&self, kind: FileWatchTargetKind) -> PathBuf {
        self.targets
            .iter()
            .find(|target| target.kind() == kind)
            .map(|target| target.path().to_path_buf())
            .unwrap_or_default()
    }

    fn matching_target_kinds(
        event: &Event,
        targets: &[FileWatchTarget],
    ) -> Vec<FileWatchTargetKind> {
        if matches!(
            event.kind,
            EventKind::Access(AccessKind::Any | AccessKind::Read)
        ) {
            return Vec::new();
        }

        targets
            .iter()
            .filter(|target| event.paths.iter().any(|path| path == target.path()))
            .map(FileWatchTarget::kind)
            .collect()
    }
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use notify::event::{DataChange, ModifyKind};

    use super::*;

    #[test]
    fn matching_target_kinds_ignores_unrelated_paths() {
        let targets = vec![FileWatchTarget::required(
            FileWatchTargetKind::Markdown,
            PathBuf::from("/workspace/spec/tasks.md"),
        )];
        let event = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Any)))
            .add_path(PathBuf::from("/workspace/spec/implementation-plan.md"));

        assert!(DebouncedWatchWorker::matching_target_kinds(&event, &targets).is_empty());
    }

    #[test]
    fn matching_target_kinds_returns_markdown_for_current_file() {
        let targets = vec![FileWatchTarget::required(
            FileWatchTargetKind::Markdown,
            PathBuf::from("/workspace/spec/tasks.md"),
        )];
        let event = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Any)))
            .add_path(PathBuf::from("/workspace/spec/tasks.md"));

        assert_eq!(
            vec![FileWatchTargetKind::Markdown],
            DebouncedWatchWorker::matching_target_kinds(&event, &targets)
        );
    }

    #[test]
    fn select_watch_parent_paths_skips_optional_missing_parent() {
        let targets = vec![
            FileWatchTarget::required(
                FileWatchTargetKind::Markdown,
                PathBuf::from("/tmp/tasks.md"),
            ),
            FileWatchTarget::optional(
                FileWatchTargetKind::Config,
                PathBuf::from("/path/that/does/not/exist/config.json"),
            ),
        ];

        let result = FileWatchManager::select_watch_parent_paths(&targets)
            .expect("required parent should exist");

        assert_eq!(vec![PathBuf::from("/tmp")], result.watched_paths);
        assert_eq!(
            vec![PathBuf::from("/path/that/does/not/exist/config.json")],
            result.skipped_paths
        );
    }
}
