//! Watch plans describing which spec and config files to observe.

use std::{
    path::{Path, PathBuf},
    time::Duration,
};

use crate::{
    app::use_cases::{AppUseCaseError, LoadWorkspaceResult},
    domain::spec::SpecFileKey,
    domain::workspace::WorkspaceConfig,
    infrastructure::{
        filesystem::SpecPathResolver,
        markdown::SpecDocumentPathResolver,
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
    pub(super) fn required(kind: FileWatchTargetKind, path: PathBuf) -> Self {
        Self {
            kind,
            path,
            required: true,
        }
    }

    pub(super) fn optional(kind: FileWatchTargetKind, path: PathBuf) -> Self {
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

    pub(super) fn is_required(&self) -> bool {
        self.required
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

    pub(super) fn debounce(&self) -> Duration {
        self.debounce
    }
}

pub fn plan_file_watch(
    workspace: &LoadWorkspaceResult,
    effective_config: &WorkspaceConfig,
    spec_id: &str,
    file_key: SpecFileKey,
) -> Result<FileWatchPlan, AppUseCaseError> {
    let resolved_document_path =
        SpecDocumentPathResolver::resolve(workspace.layout(), effective_config, spec_id, file_key)?;
    let config_path = config_file_path(workspace.layout());
    let spec_override_config_path = spec_override_config_file_path(
        &SpecPathResolver::spec_directory_path(workspace.layout(), spec_id)?,
    );
    let scope = FileWatchScope::new(workspace.layout().root().as_str(), spec_id, file_key);
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

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        time::{SystemTime, UNIX_EPOCH},
    };

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
}
