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
    spec::{SpecDomainError, SpecFileKey},
    workspace::{
        WorkspaceConfig, WorkspaceConfigError, WorkspaceFileMapping, WorkspaceKind, WorkspaceLayout,
    },
};

const PLUGIN_WORKSPACE_CONFIG_FILE: &str = ".plugin-workspace/config.json";
const SPEC_SKILL_CONFIG_FILE: &str = ".spec-skill/config.json";

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

        let user_config = parse_workspace_config(&contents, &path)?;

        Ok(defaults.merge_user_config(user_config))
    }
}

pub fn config_file_path(layout: &WorkspaceLayout) -> PathBuf {
    PathBuf::from(layout.root().as_str()).join(config_file_name_for_kind(layout.kind()))
}

fn config_file_name_for_kind(kind: WorkspaceKind) -> &'static str {
    match kind {
        WorkspaceKind::PluginWorkspace => PLUGIN_WORKSPACE_CONFIG_FILE,
        WorkspaceKind::SpecSkill => SPEC_SKILL_CONFIG_FILE,
    }
}

fn parse_workspace_config(contents: &str, path: &Path) -> Result<WorkspaceConfig, ConfigLoadError> {
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
        let mapping = WorkspaceFileMapping::new(key, file_name).map_err(|source| {
            ConfigLoadError::InvalidFileMapping {
                path: display_path(path),
                source,
            }
        })?;

        files.push(mapping);
    }

    WorkspaceConfig::new(files).map_err(|source| ConfigLoadError::InvalidFileMapping {
        path: display_path(path),
        source,
    })
}

#[derive(Debug, Deserialize)]
struct RawWorkspaceConfig {
    #[serde(default)]
    files: BTreeMap<String, String>,
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
    fn config_file_path_uses_spec_skill_location() {
        let workspace = TestWorkspace::new("spec-skill-location");
        let layout = workspace.layout(WorkspaceKind::SpecSkill);

        assert_eq!(
            workspace.root().join(SPEC_SKILL_CONFIG_FILE),
            config_file_path(&layout)
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
                (SpecFileKey::Exploration, "exploration.md"),
                (SpecFileKey::Hearing, "hearing.md"),
                (SpecFileKey::Impl, "impl.md"),
                (SpecFileKey::Tasks, "tasks.md"),
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
            Some("exploration.md"),
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
    fn config_loader_merges_valid_spec_skill_config_over_defaults() {
        let workspace = TestWorkspace::new("valid-spec-skill");
        workspace.write_config(
            SPEC_SKILL_CONFIG_FILE,
            r#"{
                "files": {
                    "design": "implementation-plan.md",
                    "tasks": "todo.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::SpecSkill);

        let config = WorkspaceConfigLoader::new()
            .load(&layout)
            .expect("valid config should be loaded");

        assert_eq!(
            Some("requirements.md"),
            config
                .file_for_key(SpecFileKey::Requirements)
                .map(WorkspaceFileMapping::file_name)
        );
        assert_eq!(
            Some("implementation-plan.md"),
            config
                .file_for_key(SpecFileKey::Design)
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
            Some("exploration.md"),
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
    fn config_loader_returns_typed_error_for_unsupported_file_key() {
        let workspace = TestWorkspace::new("unsupported-key");
        workspace.write_config(
            PLUGIN_WORKSPACE_CONFIG_FILE,
            r#"{
                "files": {
                    "unknown": "unknown.md"
                }
            }"#,
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let result = WorkspaceConfigLoader::new().load(&layout);

        assert!(matches!(
            result,
            Err(ConfigLoadError::InvalidFileKey { key, .. }) if key == "unknown"
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
}
