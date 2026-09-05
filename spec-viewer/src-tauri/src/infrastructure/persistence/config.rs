//! Workspace config persistence.

use std::{
    collections::BTreeMap,
    fs, io,
    path::{Path, PathBuf},
    str::FromStr,
};

use serde::Deserialize;
use thiserror::Error;

use crate::domain::{
    spec::{SpecDomainError, SpecFileKey, SpecId},
    workspace::{
        default_scan_excluded_directory_names, LoadWorkspaceConfig, SpecConfigOverride,
        SpecOverrideNodeKind, WorkspaceConfig, WorkspaceConfigError, WorkspaceConfigLoadPortError,
        WorkspaceConfigSource, WorkspaceFileMapping, WorkspaceKind, WorkspaceLayout,
    },
};
use crate::infrastructure::filesystem::spec_directory_path;

const PLUGIN_WORKSPACE_CONFIG_FILE: &str = ".plugin-workspace/config.json";
const PLUGIN_WORKTREE_CONFIG_FILE: &str = "config.json";
const SPEC_SKILL_CONFIG_FILE: &str = ".spec-skill/config.json";
const SPEC_OVERRIDE_CONFIG_FILE: &str = ".spec-reviewer/config.json";

#[derive(Debug, Clone, Copy, Default)]
pub struct WorkspaceConfigLoader;

impl WorkspaceConfigLoader {
    pub fn new() -> Self {
        Self
    }

    pub fn load(&self, layout: &WorkspaceLayout) -> Result<WorkspaceConfig, ConfigLoadError> {
        let defaults = WorkspaceConfig::default_for(layout.kind());
        let path = config_file_path(layout);

        let contents = match fs::read_to_string(&path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(defaults),
            Err(source) => {
                return Err(ConfigLoadError::ReadFile {
                    path: display_path(&path),
                    source,
                });
            }
        };

        let user_config =
            parse_workspace_config(&contents, &path, WorkspaceConfigSource::WorkspaceConfig)?;

        Ok(defaults.merge_user_config(user_config))
    }

    pub fn load_spec_override_from_directory(
        &self,
        spec_directory: &Path,
    ) -> Result<Option<SpecConfigOverride>, ConfigLoadError> {
        let path = spec_override_config_file_path(spec_directory);

        let contents = match fs::read_to_string(&path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(source) => {
                return Err(ConfigLoadError::ReadFile {
                    path: display_path(&path),
                    source,
                });
            }
        };

        parse_spec_config_override(&contents, &path).map(Some)
    }
}

impl LoadWorkspaceConfig for WorkspaceConfigLoader {
    fn load_workspace_config(
        &self,
        layout: &WorkspaceLayout,
    ) -> Result<WorkspaceConfig, WorkspaceConfigLoadPortError> {
        self.load(layout)
            .map_err(|source| WorkspaceConfigLoadPortError::new(source.to_string()))
    }

    fn load_spec_config_override(
        &self,
        layout: &WorkspaceLayout,
        spec_id: &SpecId,
    ) -> Result<Option<SpecConfigOverride>, WorkspaceConfigLoadPortError> {
        let spec_directory = spec_directory_path(layout, spec_id);

        self.load_spec_override_from_directory(&spec_directory)
            .map_err(|source| WorkspaceConfigLoadPortError::new(source.to_string()))
    }
}

pub fn config_file_path(layout: &WorkspaceLayout) -> PathBuf {
    PathBuf::from(layout.root().as_str()).join(config_file_name_for_kind(layout.kind()))
}

pub fn spec_override_config_file_path(spec_directory: &Path) -> PathBuf {
    spec_directory.join(SPEC_OVERRIDE_CONFIG_FILE)
}

fn config_file_name_for_kind(kind: WorkspaceKind) -> &'static str {
    match kind {
        WorkspaceKind::PluginWorkspace => PLUGIN_WORKSPACE_CONFIG_FILE,
        WorkspaceKind::PluginWorktree => PLUGIN_WORKTREE_CONFIG_FILE,
        WorkspaceKind::SpecSkill => SPEC_SKILL_CONFIG_FILE,
    }
}

fn parse_workspace_config(
    contents: &str,
    path: &Path,
    source: WorkspaceConfigSource,
) -> Result<WorkspaceConfig, ConfigLoadError> {
    let raw_config: RawWorkspaceConfig =
        serde_json::from_str(contents).map_err(|source| ConfigLoadError::MalformedJson {
            path: display_path(path),
            source,
        })?;

    if raw_config.node_kind.is_some() {
        return Err(ConfigLoadError::UnexpectedNodeKind {
            path: display_path(path),
        });
    }

    let mut files = Vec::with_capacity(raw_config.files.len());

    for (raw_key, file_name) in raw_config.files {
        let key =
            SpecFileKey::from_str(&raw_key).map_err(|source| ConfigLoadError::InvalidFileKey {
                path: display_path(path),
                key: raw_key,
                source,
            })?;
        let mapping =
            WorkspaceFileMapping::with_source(key, file_name, source).map_err(|source| {
                ConfigLoadError::InvalidFileMapping {
                    path: display_path(path),
                    source,
                }
            })?;

        files.push(mapping);
    }

    WorkspaceConfig::with_scan_excluded_directory_names(
        files,
        raw_config
            .scan_excluded_directory_names
            .unwrap_or_else(default_scan_excluded_directory_names),
    )
    .map_err(|source| ConfigLoadError::InvalidFileMapping {
        path: display_path(path),
        source,
    })
}

fn parse_spec_config_override(
    contents: &str,
    path: &Path,
) -> Result<SpecConfigOverride, ConfigLoadError> {
    let raw_config: RawWorkspaceConfig =
        serde_json::from_str(contents).map_err(|source| ConfigLoadError::MalformedJson {
            path: display_path(path),
            source,
        })?;

    let mut files = Vec::with_capacity(raw_config.files.len());

    for (raw_key, file_name) in raw_config.files {
        let key =
            SpecFileKey::from_str(&raw_key).map_err(|source| ConfigLoadError::InvalidFileKey {
                path: display_path(path),
                key: raw_key,
                source,
            })?;
        let mapping =
            WorkspaceFileMapping::with_source(key, file_name, WorkspaceConfigSource::SpecOverride)
                .map_err(|source| ConfigLoadError::InvalidFileMapping {
                    path: display_path(path),
                    source,
                })?;

        files.push(mapping);
    }

    let node_kind = raw_config
        .node_kind
        .map(|value| {
            SpecOverrideNodeKind::try_from(value).map_err(|value| {
                ConfigLoadError::InvalidNodeKind {
                    path: display_path(path),
                    value,
                }
            })
        })
        .transpose()?;

    SpecConfigOverride::with_node_kind(files, node_kind).map_err(|source| {
        ConfigLoadError::InvalidFileMapping {
            path: display_path(path),
            source,
        }
    })
}

#[derive(Debug, Deserialize)]
struct RawWorkspaceConfig {
    #[serde(default)]
    files: BTreeMap<String, String>,
    #[serde(rename = "scanExcludedDirectoryNames")]
    scan_excluded_directory_names: Option<Vec<String>>,
    #[serde(rename = "nodeKind")]
    node_kind: Option<RawSpecOverrideNodeKind>,
}

#[derive(Debug, Deserialize)]
#[serde(transparent)]
struct RawSpecOverrideNodeKind(String);

impl TryFrom<RawSpecOverrideNodeKind> for SpecOverrideNodeKind {
    type Error = String;

    fn try_from(value: RawSpecOverrideNodeKind) -> Result<Self, Self::Error> {
        let RawSpecOverrideNodeKind(value) = value;

        match value.as_str() {
            "spec" => Ok(Self::Spec),
            "category" => Ok(Self::Category),
            _ => Err(value),
        }
    }
}

#[derive(Debug, Error)]
pub enum ConfigLoadError {
    #[error("failed to read workspace config: {path}")]
    ReadFile { path: String, source: io::Error },
    #[error("workspace config JSON is malformed: {path}")]
    MalformedJson {
        path: String,
        source: serde_json::Error,
    },
    #[error("nodeKind is only supported in spec override config: {path}")]
    UnexpectedNodeKind { path: String },
    #[error("spec override nodeKind is invalid in {path}: {value}")]
    InvalidNodeKind { path: String, value: String },
    #[error("workspace config file key is invalid in {path}: {key}")]
    InvalidFileKey {
        path: String,
        key: String,
        source: SpecDomainError,
    },
    #[error("workspace config file mapping is invalid in {path}")]
    InvalidFileMapping {
        path: String,
        source: WorkspaceConfigError,
    },
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::workspace::{WorkspaceLayout, WorkspaceRoot};

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
                "spec-reviewer-config-loading-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&root).expect("test workspace root should be created");

            Self { root }
        }

        fn root(&self) -> &Path {
            &self.root
        }

        fn layout(&self, kind: WorkspaceKind) -> WorkspaceLayout {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("test workspace root should be valid");

            WorkspaceLayout::new(root, kind)
        }

        fn write_config(&self, relative_path: &str, contents: &str) {
            let path = self.root.join(relative_path);
            let parent = path.parent().expect("config path should have a parent");
            fs::create_dir_all(parent).expect("config directory should be created");
            fs::write(path, contents).expect("config file should be written");
        }

        fn spec_directory(&self, relative_path: &str) -> PathBuf {
            self.root.join(relative_path)
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn config_file_path_uses_plugin_workspace_location() {
        let workspace = TestWorkspace::new("plugin-location");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        assert_eq!(
            workspace.root().join(PLUGIN_WORKSPACE_CONFIG_FILE),
            config_file_path(&layout)
        );
    }

    #[test]
    fn spec_override_config_file_path_uses_hidden_spec_reviewer_location() {
        let workspace = TestWorkspace::new("override-location");
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/auth");

        assert_eq!(
            spec_directory.join(SPEC_OVERRIDE_CONFIG_FILE),
            spec_override_config_file_path(&spec_directory)
        );
    }

    #[test]
    fn config_loader_returns_defaults_when_config_is_missing() {
        let workspace = TestWorkspace::new("missing");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let config = WorkspaceConfigLoader::new()
            .load(&layout)
            .expect("missing config should fall back to defaults");

        let files: Vec<(SpecFileKey, &str)> = config
            .files()
            .iter()
            .map(|file| (file.key(), file.file_name()))
            .collect();

        assert_eq!(
            vec![
                (SpecFileKey::Impl, "implementation-plan.md"),
                (SpecFileKey::Tasks, "tasks.md"),
                (SpecFileKey::Requirements, "requirements.html"),
                (SpecFileKey::TechReference, "tech-reference.html"),
                (SpecFileKey::TestCases, "test-cases.html"),
                (SpecFileKey::Exploration, "exploration-report.md"),
                (SpecFileKey::Hearing, "hearing-notes.md"),
                (SpecFileKey::QuizPlan, "understanding-quiz-plan.html"),
                (SpecFileKey::QuizImpl, "understanding-quiz-impl.html"),
            ],
            files
        );
    }

    #[test]
    fn config_loader_merges_valid_plugin_workspace_config_over_defaults() {
        let workspace = TestWorkspace::new("valid-plugin");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "files": {
                    "hearing": "interview.md",
                    "tasks": "todo.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let config = WorkspaceConfigLoader::new()
            .load(&layout)
            .expect("valid config should be loaded");

        assert_eq!(
            Some("exploration-report.md"),
            config
                .file_for_key(SpecFileKey::Exploration)
                .map(WorkspaceFileMapping::file_name)
        );
        assert_eq!(
            Some("interview.md"),
            config
                .file_for_key(SpecFileKey::Hearing)
                .map(WorkspaceFileMapping::file_name)
        );
        assert_eq!(
            Some("todo.md"),
            config
                .file_for_key(SpecFileKey::Tasks)
                .map(WorkspaceFileMapping::file_name)
        );
    }

    #[test]
    fn config_loader_keeps_defaults_for_partial_config() {
        let workspace = TestWorkspace::new("partial");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "files": {
                    "impl": "implementation-plan.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let config = WorkspaceConfigLoader::new()
            .load(&layout)
            .expect("partial config should be merged with defaults");

        assert_eq!(
            Some("exploration-report.md"),
            config
                .file_for_key(SpecFileKey::Exploration)
                .map(WorkspaceFileMapping::file_name)
        );
        assert_eq!(
            Some("implementation-plan.md"),
            config
                .file_for_key(SpecFileKey::Impl)
                .map(WorkspaceFileMapping::file_name)
        );
        assert_eq!(
            Some("tasks.md"),
            config
                .file_for_key(SpecFileKey::Tasks)
                .map(WorkspaceFileMapping::file_name)
        );
    }

    #[test]
    fn config_loader_uses_default_scan_exclusions_when_field_is_missing() {
        let workspace = TestWorkspace::new("scan-defaults");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "files": {
                    "tasks": "tasks.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let config = WorkspaceConfigLoader::new()
            .load(&layout)
            .expect("config should load");

        assert_eq!(
            vec!["plan-review".to_string(), "user-review".to_string()],
            config.scan_excluded_directory_names()
        );
    }

    #[test]
    fn config_loader_allows_empty_scan_exclusions() {
        let workspace = TestWorkspace::new("scan-empty");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "scanExcludedDirectoryNames": [],
                "files": {
                    "tasks": "tasks.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let config = WorkspaceConfigLoader::new()
            .load(&layout)
            .expect("config should load");

        assert!(config.scan_excluded_directory_names().is_empty());
    }

    #[test]
    fn config_loader_merges_spec_override_after_workspace_config() {
        let workspace = TestWorkspace::new("spec-override");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "files": {
                    "tasks": "workspace-tasks.md"
                }
            }"#,
        );
        workspace.write_config(
            ".plugin-workspace/.specs/auth/.spec-reviewer/config.json",
            r#"{
                "files": {
                    "tasks": "auth-tasks.md",
                    "requirements": "auth-requirements.html"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let workspace_config = WorkspaceConfigLoader::new()
            .load(&layout)
            .expect("workspace config should be loaded");
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/auth");
        let spec_override = WorkspaceConfigLoader::new()
            .load_spec_override_from_directory(&spec_directory)
            .expect("override should load")
            .expect("override should exist");

        let config = workspace_config.merge_spec_override(&spec_override);

        assert_eq!(
            Some("auth-tasks.md"),
            config
                .file_for_key(SpecFileKey::Tasks)
                .map(WorkspaceFileMapping::file_name)
        );
        assert_eq!(
            Some(WorkspaceConfigSource::SpecOverride),
            config
                .file_for_key(SpecFileKey::Tasks)
                .map(WorkspaceFileMapping::source)
        );
        assert_eq!(
            Some("auth-requirements.html"),
            config
                .file_for_key(SpecFileKey::Requirements)
                .map(WorkspaceFileMapping::file_name)
        );
    }

    #[test]
    fn raw_spec_override_node_kind_preserves_unknown_string_for_typed_conversion() {
        let raw: RawSpecOverrideNodeKind =
            serde_json::from_str(r#""archive""#).expect("raw string should deserialize");

        assert_eq!(
            SpecOverrideNodeKind::try_from(raw),
            Err("archive".to_string())
        );
        assert!(serde_json::from_str::<RawSpecOverrideNodeKind>("1").is_err());
    }

    #[test]
    fn config_loader_reads_explicit_spec_node_kind_override() {
        let workspace = TestWorkspace::new("node-kind-spec");
        workspace.write_config(
            ".plugin-workspace/.specs/auth/.spec-reviewer/config.json",
            r#"{ "nodeKind": "spec" }"#,
        );
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/auth");

        let spec_override = WorkspaceConfigLoader::new()
            .load_spec_override_from_directory(&spec_directory)
            .expect("override should load")
            .expect("override should exist");

        assert_eq!(Some(SpecOverrideNodeKind::Spec), spec_override.node_kind());
    }

    #[test]
    fn config_loader_reads_explicit_category_node_kind_override() {
        let workspace = TestWorkspace::new("node-kind-category");
        workspace.write_config(
            ".plugin-workspace/.specs/planning/.spec-reviewer/config.json",
            r#"{ "nodeKind": "category" }"#,
        );
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/planning");

        let spec_override = WorkspaceConfigLoader::new()
            .load_spec_override_from_directory(&spec_directory)
            .expect("override should load")
            .expect("override should exist");

        assert_eq!(
            Some(SpecOverrideNodeKind::Category),
            spec_override.node_kind()
        );
    }

    #[test]
    fn config_loader_rejects_invalid_spec_node_kind_override() {
        let workspace = TestWorkspace::new("invalid-node-kind");
        workspace.write_config(
            ".plugin-workspace/.specs/auth/.spec-reviewer/config.json",
            r#"{ "nodeKind": "archive" }"#,
        );
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/auth");

        let result =
            WorkspaceConfigLoader::new().load_spec_override_from_directory(&spec_directory);

        assert!(matches!(
            result,
            Err(ConfigLoadError::InvalidNodeKind { value, .. }) if value == "archive"
        ));
    }

    #[test]
    fn config_loader_classifies_non_string_node_kind_as_malformed_json() {
        let workspace = TestWorkspace::new("non-string-node-kind");
        workspace.write_config(
            ".plugin-workspace/.specs/auth/.spec-reviewer/config.json",
            r#"{ "nodeKind": 1 }"#,
        );
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/auth");

        let result =
            WorkspaceConfigLoader::new().load_spec_override_from_directory(&spec_directory);

        assert!(matches!(
            result,
            Err(ConfigLoadError::MalformedJson { path, .. })
                if path.ends_with(SPEC_OVERRIDE_CONFIG_FILE)
        ));
    }

    #[test]
    fn config_loader_rejects_node_kind_in_workspace_config() {
        for (name, node_kind) in [
            ("workspace-category-node-kind", "category"),
            ("workspace-unknown-node-kind", "archive"),
        ] {
            let workspace = TestWorkspace::new(name);
            workspace.write_config(
                PLUGIN_WORKSPACE_CONFIG_FILE,
                &format!(r#"{{ "nodeKind": "{node_kind}" }}"#),
            );
            let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

            let result = WorkspaceConfigLoader::new().load(&layout);

            assert!(matches!(
                result,
                Err(ConfigLoadError::UnexpectedNodeKind { .. })
            ));
        }
    }

    #[test]
    fn config_loader_returns_none_when_spec_override_is_missing() {
        let workspace = TestWorkspace::new("missing-override");
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/auth");

        let override_config = WorkspaceConfigLoader::new()
            .load_spec_override_from_directory(&spec_directory)
            .expect("missing override should be accepted");

        assert_eq!(None, override_config);
    }

    #[test]
    fn config_loader_returns_typed_error_for_malformed_json() {
        let workspace = TestWorkspace::new("malformed");
        workspace.write_config(PLUGIN_WORKSPACE_CONFIG_FILE, r#"{"files":"#);
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let result = WorkspaceConfigLoader::new().load(&layout);

        assert!(matches!(
            result,
            Err(ConfigLoadError::MalformedJson { path, .. })
                if path.ends_with(PLUGIN_WORKSPACE_CONFIG_FILE)
        ));
    }

    #[test]
    fn config_loader_rejects_retired_design_file_key() {
        let workspace = TestWorkspace::new("unsupported-key");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "files": {
                    "design": "design.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let result = WorkspaceConfigLoader::new().load(&layout);

        assert!(matches!(
            result,
            Err(ConfigLoadError::InvalidFileKey { key, .. }) if key == "design"
        ));
    }

    #[test]
    fn config_loader_returns_typed_error_for_invalid_file_mapping() {
        let workspace = TestWorkspace::new("invalid-mapping");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "files": {
                    "tasks": "../tasks.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let result = WorkspaceConfigLoader::new().load(&layout);

        assert!(matches!(
            result,
            Err(ConfigLoadError::InvalidFileMapping {
                source: WorkspaceConfigError::UnsafeFileName {
                    key: SpecFileKey::Tasks,
                    file_name,
                },
                ..
            }) if file_name == "../tasks.md"
        ));
    }

    #[test]
    fn config_loader_returns_typed_error_for_invalid_spec_override_mapping() {
        let workspace = TestWorkspace::new("invalid-override-mapping");
        workspace.write_config(
            ".plugin-workspace/.specs/auth/.spec-reviewer/config.json",
            r#"{
                "files": {
                    "tasks": "../tasks.md"
                }
            }"#,
        );
        let spec_directory = workspace.spec_directory(".plugin-workspace/.specs/auth");

        let result =
            WorkspaceConfigLoader::new().load_spec_override_from_directory(&spec_directory);

        assert!(matches!(
            result,
            Err(ConfigLoadError::InvalidFileMapping {
                source: WorkspaceConfigError::UnsafeFileName {
                    key: SpecFileKey::Tasks,
                    file_name,
                },
                ..
            }) if file_name == "../tasks.md"
        ));
    }
}
