//! Debounced file watching for the currently selected spec file.

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

use crate::{
    app::use_cases::{AppUseCaseError, LoadWorkspaceResult},
    domain::spec::{SpecFileKey, SpecId},
    domain::workspace::WorkspaceConfig,
    infrastructure::{
        filesystem::spec_directory_path,
        markdown::resolve_spec_document_path,
        persistence::config::{config_file_path, spec_override_config_file_path},
    },
};

const DEFAULT_DEBOUNCE_MS: u64 = 250;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileWatchScope {
    workspace_path: String,
    spec_id: String,
    file_key: SpecFileKey,
}

impl FileWatchScope {
    pub fn new(
        workspace_path: impl Into<String>,
        spec_id: impl Into<String>,
        file_key: SpecFileKey,
    ) -> Self {
        Self {
            workspace_path: workspace_path.into(),
            spec_id: spec_id.into(),
            file_key,
        }
    }

    pub fn workspace_path(&self) -> &str {
        &self.workspace_path
    }

    pub fn spec_id(&self) -> &str {
        &self.spec_id
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileWatchStrategy {
    NotifyDebouncedParentDirectories,
}

impl FileWatchStrategy {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotifyDebouncedParentDirectories => "notify_debounced_parent_directories",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FileWatchTargetKind {
    Markdown,
    Config,
}

impl FileWatchTargetKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Markdown => "markdown",
            Self::Config => "config",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileWatchTarget {
    kind: FileWatchTargetKind,
    path: PathBuf,
    required: bool,
}

impl FileWatchTarget {
    fn required(kind: FileWatchTargetKind, path: PathBuf) -> Self {
        Self {
            kind,
            path,
            required: true,
        }
    }

    fn optional(kind: FileWatchTargetKind, path: PathBuf) -> Self {
        Self {
            kind,
            path,
            required: false,
        }
    }

    pub fn kind(&self) -> FileWatchTargetKind {
        self.kind
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileWatchPlan {
    scope: FileWatchScope,
    strategy: FileWatchStrategy,
    targets: Vec<FileWatchTarget>,
    debounce: Duration,
}

impl FileWatchPlan {
    pub fn new(scope: FileWatchScope, targets: Vec<FileWatchTarget>) -> Self {
        Self {
            scope,
            strategy: FileWatchStrategy::NotifyDebouncedParentDirectories,
            targets,
            debounce: Duration::from_millis(DEFAULT_DEBOUNCE_MS),
        }
    }

    pub fn scope(&self) -> &FileWatchScope {
        &self.scope
    }

    pub fn strategy(&self) -> FileWatchStrategy {
        self.strategy
    }

    pub fn targets(&self) -> &[FileWatchTarget] {
        &self.targets
    }

    pub fn debounce_ms(&self) -> u64 {
        self.debounce.as_millis() as u64
    }
}

pub fn plan_file_watch(
    workspace: &LoadWorkspaceResult,
    effective_config: &WorkspaceConfig,
    spec_id: &str,
    file_key: SpecFileKey,
) -> Result<FileWatchPlan, AppUseCaseError> {
    let spec_id = SpecId::new(spec_id)?;
    let resolved_document_path = resolve_spec_document_path(
        workspace.layout(),
        effective_config,
        spec_id.as_str(),
        file_key,
    )?;
    let config_path = config_file_path(workspace.layout());
    let spec_override_config_path =
        spec_override_config_file_path(&spec_directory_path(workspace.layout(), &spec_id));
    let scope = FileWatchScope::new(
        workspace.layout().root().as_str(),
        spec_id.as_str(),
        file_key,
    );
    let mut targets = vec![FileWatchTarget::required(
        FileWatchTargetKind::Markdown,
        resolved_document_path.path().to_path_buf(),
    )];

    let selected_candidate_index = resolved_document_path
        .candidate_paths()
        .iter()
        .position(|candidate_path| candidate_path == resolved_document_path.path())
        .unwrap_or(0);
    let optional_candidate_paths = if resolved_document_path.path().is_file() {
        &resolved_document_path.candidate_paths()[..selected_candidate_index]
    } else {
        resolved_document_path.candidate_paths()
    };

    for candidate_path in optional_candidate_paths {
        if candidate_path.as_path() != resolved_document_path.path() {
            targets.push(FileWatchTarget::optional(
                FileWatchTargetKind::Markdown,
                candidate_path.to_path_buf(),
            ));
        }
    }

    targets.extend([
        FileWatchTarget::optional(FileWatchTargetKind::Config, config_path),
        FileWatchTarget::optional(FileWatchTargetKind::Config, spec_override_config_path),
    ]);

    Ok(FileWatchPlan::new(scope, targets))
}

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

        let watch_paths = select_watch_parent_paths(plan.targets())?;
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

        let scope = plan.scope().clone();
        let strategy = plan.strategy();
        let targets = plan.targets().to_vec();
        let debounce = plan.debounce;
        let emit = Arc::new(emit);
        let worker = thread::spawn(move || {
            run_debounced_watch_worker(scope, targets, debounce, receiver, emit);
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
            if target.required {
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

fn run_debounced_watch_worker(
    scope: FileWatchScope,
    targets: Vec<FileWatchTarget>,
    debounce: Duration,
    receiver: mpsc::Receiver<RawWatchMessage>,
    emit: Arc<dyn Fn(FileWatchNotification) + Send + Sync>,
) {
    while let Ok(message) = receiver.recv() {
        let RawWatchMessage::Notify(result) = message else {
            return;
        };

        let mut pending_changes = match collect_changes_or_error(&scope, &targets, result, &emit) {
            Some(changes) if !changes.is_empty() => changes,
            _ => continue,
        };

        loop {
            match receiver.recv_timeout(debounce) {
                Ok(RawWatchMessage::Notify(result)) => {
                    if let Some(changes) = collect_changes_or_error(&scope, &targets, result, &emit)
                    {
                        pending_changes.extend(changes);
                    }
                }
                Ok(RawWatchMessage::Stop) | Err(mpsc::RecvTimeoutError::Disconnected) => return,
                Err(mpsc::RecvTimeoutError::Timeout) => break,
            }
        }

        emit_pending_changes(&scope, pending_changes, &targets, &emit);
    }
}

fn collect_changes_or_error(
    scope: &FileWatchScope,
    targets: &[FileWatchTarget],
    result: notify::Result<Event>,
    emit: &Arc<dyn Fn(FileWatchNotification) + Send + Sync>,
) -> Option<Vec<FileWatchTargetKind>> {
    match result {
        Ok(event) => Some(matching_target_kinds(&event, targets)),
        Err(source) => {
            emit(FileWatchNotification::Error(FileWatchFailure::new(
                scope.clone(),
                source.to_string(),
            )));
            None
        }
    }
}

fn emit_pending_changes(
    scope: &FileWatchScope,
    changes: Vec<FileWatchTargetKind>,
    targets: &[FileWatchTarget],
    emit: &Arc<dyn Fn(FileWatchNotification) + Send + Sync>,
) {
    let mut remaining = VecDeque::from(changes);
    let mut emitted = HashSet::new();

    while let Some(kind) = remaining.pop_front() {
        if !emitted.insert(kind) {
            continue;
        }

        emit(FileWatchNotification::Changed(FileWatchChange::new(
            scope.clone(),
            kind,
            path_for_kind(kind, targets),
        )));
    }
}

fn path_for_kind(kind: FileWatchTargetKind, targets: &[FileWatchTarget]) -> PathBuf {
    targets
        .iter()
        .find(|target| target.kind() == kind)
        .map(|target| target.path().to_path_buf())
        .unwrap_or_default()
}

fn matching_target_kinds(event: &Event, targets: &[FileWatchTarget]) -> Vec<FileWatchTargetKind> {
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

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use notify::event::{DataChange, ModifyKind};

    use super::*;
    use crate::domain::workspace::{WorkspaceKind, WorkspaceLayout, WorkspaceRoot};

    struct TestWorkspace {
        root: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let root = env::temp_dir().join(format!(
                "spec-reviewer-file-watch-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&root).expect("test workspace root should be created");

            Self { root }
        }

        fn write_file(&self, path: &str, contents: &str) {
            let path = self.root.join(path);
            let parent = path.parent().expect("test file should have parent");
            fs::create_dir_all(parent).expect("test file parent should be created");
            fs::write(path, contents).expect("test file should be written");
        }

        fn create_dir(&self, path: &str) {
            fs::create_dir_all(self.root.join(path)).expect("test directory should be created");
        }

        fn workspace(&self) -> LoadWorkspaceResult {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("test workspace root should be valid");
            let layout = WorkspaceLayout::new(root, WorkspaceKind::PluginWorkspace);

            LoadWorkspaceResult::new(
                layout,
                WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
            )
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn matching_target_kinds_ignores_unrelated_paths() {
        let targets = vec![FileWatchTarget::required(
            FileWatchTargetKind::Markdown,
            PathBuf::from("/workspace/spec/tasks.md"),
        )];
        let event = Event::new(EventKind::Modify(ModifyKind::Data(DataChange::Any)))
            .add_path(PathBuf::from("/workspace/spec/implementation-plan.md"));

        assert!(matching_target_kinds(&event, &targets).is_empty());
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
            matching_target_kinds(&event, &targets)
        );
    }

    #[test]
    fn plan_file_watch_tracks_html_fallback_and_preferred_markdown_path() {
        let workspace = TestWorkspace::new("html-fallback");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.html", "<h1>Tasks</h1>");
        let loaded_workspace = workspace.workspace();

        let plan = plan_file_watch(
            &loaded_workspace,
            loaded_workspace.config(),
            "auth",
            SpecFileKey::Tasks,
        )
        .expect("watch plan should be created");

        let markdown_targets: Vec<&Path> = plan
            .targets()
            .iter()
            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
            .map(FileWatchTarget::path)
            .collect();

        assert_eq!(2, markdown_targets.len());
        assert!(markdown_targets[0].ends_with("auth/tasks.html"));
        assert!(markdown_targets[1].ends_with("auth/tasks.md"));
    }

    #[test]
    fn plan_file_watch_skips_lower_priority_html_fallback_when_markdown_is_active() {
        let workspace = TestWorkspace::new("markdown-active");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Tasks");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.html", "<h1>Tasks</h1>");
        let loaded_workspace = workspace.workspace();

        let plan = plan_file_watch(
            &loaded_workspace,
            loaded_workspace.config(),
            "auth",
            SpecFileKey::Tasks,
        )
        .expect("watch plan should be created");

        let markdown_targets: Vec<&Path> = plan
            .targets()
            .iter()
            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
            .map(FileWatchTarget::path)
            .collect();

        assert_eq!(1, markdown_targets.len());
        assert!(markdown_targets[0].ends_with("auth/tasks.md"));
    }

    #[test]
    fn plan_file_watch_tracks_both_missing_tech_reference_candidates() {
        let workspace = TestWorkspace::new("tech-reference-missing");
        workspace.create_dir(".plugin-workspace/.specs/auth");
        let loaded_workspace = workspace.workspace();

        let plan = plan_file_watch(
            &loaded_workspace,
            loaded_workspace.config(),
            "auth",
            SpecFileKey::TechReference,
        )
        .expect("watch plan should be created");

        let markdown_targets: Vec<&Path> = plan
            .targets()
            .iter()
            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
            .map(FileWatchTarget::path)
            .collect();

        assert_eq!(2, markdown_targets.len());
        assert!(markdown_targets[0].ends_with("auth/tech-reference.html"));
        assert!(markdown_targets[1].ends_with("auth/tech-reference.md"));
    }

    #[test]
    fn plan_file_watch_tracks_requirements_html_and_markdown_candidates() {
        let workspace = TestWorkspace::new("requirements-markdown-fallback");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/requirements.md",
            "# Requirements",
        );
        let loaded_workspace = workspace.workspace();

        let plan = plan_file_watch(
            &loaded_workspace,
            loaded_workspace.config(),
            "auth",
            SpecFileKey::Requirements,
        )
        .expect("watch plan should be created");

        let markdown_targets: Vec<&Path> = plan
            .targets()
            .iter()
            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
            .map(FileWatchTarget::path)
            .collect();

        assert_eq!(2, markdown_targets.len());
        assert!(markdown_targets[0].ends_with("auth/requirements.md"));
        assert!(markdown_targets[1].ends_with("auth/requirements.html"));
    }

    #[test]
    fn plan_file_watch_tracks_test_cases_html_and_markdown_candidates() {
        let workspace = TestWorkspace::new("test-cases-markdown-fallback");
        workspace.write_file(".plugin-workspace/.specs/auth/test-cases.md", "# Cases");
        let loaded_workspace = workspace.workspace();

        let plan = plan_file_watch(
            &loaded_workspace,
            loaded_workspace.config(),
            "auth",
            SpecFileKey::TestCases,
        )
        .expect("watch plan should be created");

        let markdown_targets: Vec<&Path> = plan
            .targets()
            .iter()
            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
            .map(FileWatchTarget::path)
            .collect();

        assert_eq!(2, markdown_targets.len());
        assert!(markdown_targets[0].ends_with("auth/test-cases.md"));
        assert!(markdown_targets[1].ends_with("auth/test-cases.html"));
    }

    #[test]
    fn plan_file_watch_tracks_preferred_html_when_tech_reference_markdown_is_active() {
        let workspace = TestWorkspace::new("tech-reference-markdown-fallback");
        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");
        let loaded_workspace = workspace.workspace();

        let plan = plan_file_watch(
            &loaded_workspace,
            loaded_workspace.config(),
            "auth",
            SpecFileKey::TechReference,
        )
        .expect("watch plan should be created");

        let markdown_targets: Vec<&Path> = plan
            .targets()
            .iter()
            .filter(|target| target.kind() == FileWatchTargetKind::Markdown)
            .map(FileWatchTarget::path)
            .collect();

        assert_eq!(2, markdown_targets.len());
        assert!(markdown_targets[0].ends_with("auth/tech-reference.md"));
        assert!(markdown_targets[1].ends_with("auth/tech-reference.html"));
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

        let result = select_watch_parent_paths(&targets).expect("required parent should exist");

        assert_eq!(vec![PathBuf::from("/tmp")], result.watched_paths);
        assert_eq!(
            vec![PathBuf::from("/path/that/does/not/exist/config.json")],
            result.skipped_paths
        );
    }
}
