//! Workspace config domain concepts.

use std::collections::HashSet;

use thiserror::Error;

use crate::domain::spec::SpecFileKey;

use super::WorkspaceKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WorkspaceConfigSource {
    Default,
    WorkspaceConfig,
    SpecOverride,
}

impl WorkspaceConfigSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Default => "default",
            Self::WorkspaceConfig => "workspaceConfig",
            Self::SpecOverride => "specOverride",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceFileMapping {
    key: SpecFileKey,
    file_name: String,
    source: WorkspaceConfigSource,
}

impl WorkspaceFileMapping {
    pub fn new(
        key: SpecFileKey,
        file_name: impl Into<String>,
    ) -> Result<Self, WorkspaceConfigError> {
        Self::with_source(key, file_name, WorkspaceConfigSource::WorkspaceConfig)
    }

    pub fn with_source(
        key: SpecFileKey,
        file_name: impl Into<String>,
        source: WorkspaceConfigSource,
    ) -> Result<Self, WorkspaceConfigError> {
        let file_name = file_name.into();
        let trimmed = file_name.trim();

        if trimmed.is_empty() {
            return Err(WorkspaceConfigError::MissingFileName { key });
        }

        validate_safe_file_name(key, trimmed)?;

        Ok(Self {
            key,
            file_name: trimmed.to_string(),
            source,
        })
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn file_name(&self) -> &str {
        &self.file_name
    }

    pub fn source(&self) -> WorkspaceConfigSource {
        self.source
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceConfig {
    files: Vec<WorkspaceFileMapping>,
    scan_excluded_directory_names: Vec<String>,
}

impl WorkspaceConfig {
    pub fn new(files: Vec<WorkspaceFileMapping>) -> Result<Self, WorkspaceConfigError> {
        Self::with_scan_excluded_directory_names(files, default_scan_excluded_directory_names())
    }

    pub fn with_scan_excluded_directory_names(
        files: Vec<WorkspaceFileMapping>,
        scan_excluded_directory_names: Vec<String>,
    ) -> Result<Self, WorkspaceConfigError> {
        let mut seen_keys = HashSet::new();

        for file in &files {
            if !seen_keys.insert(file.key()) {
                return Err(WorkspaceConfigError::DuplicateFileKey { key: file.key() });
            }
        }

        Ok(Self {
            files,
            scan_excluded_directory_names: validate_scan_excluded_directory_names(
                scan_excluded_directory_names,
            )?,
        })
    }

    pub fn default_for(kind: WorkspaceKind) -> Self {
        match kind {
            WorkspaceKind::PluginWorkspace | WorkspaceKind::PluginWorktree => {
                Self::plugin_workspace_default()
            }
            WorkspaceKind::SpecSkill => Self::spec_skill_default(),
        }
    }

    pub fn plugin_workspace_default() -> Self {
        Self::from_default_keys(
            SpecFileKey::default_keys(),
            plugin_workspace_default_file_name,
        )
    }

    pub fn spec_skill_default() -> Self {
        Self::from_default_keys(
            SpecFileKey::compatibility_keys(),
            spec_skill_default_file_name,
        )
    }

    pub fn merge_user_config(&self, user_config: Self) -> Self {
        let mut files = self.files.clone();

        for user_file in user_config.files {
            match files
                .iter()
                .position(|default_file| default_file.key() == user_file.key())
            {
                Some(index) => files[index] = user_file,
                None => files.push(user_file),
            }
        }

        Self {
            files,
            scan_excluded_directory_names: user_config.scan_excluded_directory_names,
        }
    }

    pub fn merge_spec_override(&self, spec_override: &SpecConfigOverride) -> Self {
        let mut files = self.files.clone();

        for override_file in spec_override.config.files.clone() {
            match files
                .iter()
                .position(|default_file| default_file.key() == override_file.key())
            {
                Some(index) => files[index] = override_file,
                None => files.push(override_file),
            }
        }

        Self {
            files,
            scan_excluded_directory_names: self.scan_excluded_directory_names.clone(),
        }
    }

    pub fn files(&self) -> &[WorkspaceFileMapping] {
        &self.files
    }

    pub fn file_for_key(&self, key: SpecFileKey) -> Option<&WorkspaceFileMapping> {
        self.files.iter().find(|file| file.key() == key)
    }

    pub fn scan_excluded_directory_names(&self) -> &[String] {
        &self.scan_excluded_directory_names
    }

    fn from_default_keys(
        keys: &[SpecFileKey],
        default_file_name: fn(SpecFileKey) -> &'static str,
    ) -> Self {
        let files = keys
            .iter()
            .map(|key| {
                WorkspaceFileMapping::with_source(
                    *key,
                    default_file_name(*key),
                    WorkspaceConfigSource::Default,
                )
                .expect("workspace default file names should be valid")
            })
            .collect();

        Self::new(files).expect("workspace default keys should be unique")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecConfigOverride {
    config: WorkspaceConfig,
}

impl SpecConfigOverride {
    pub fn new(files: Vec<WorkspaceFileMapping>) -> Result<Self, WorkspaceConfigError> {
        Ok(Self {
            config: WorkspaceConfig::new(files)?,
        })
    }

    pub fn config(&self) -> &WorkspaceConfig {
        &self.config
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum WorkspaceConfigError {
    #[error("duplicate logical file key in workspace config: {key}")]
    DuplicateFileKey { key: SpecFileKey },
    #[error("file name is required for workspace config key: {key}")]
    MissingFileName { key: SpecFileKey },
    #[error("unsafe file name for workspace config key {key}: {file_name}")]
    UnsafeFileName { key: SpecFileKey, file_name: String },
    #[error("unsafe scan excluded directory name in workspace config: {name}")]
    UnsafeScanExcludedDirectoryName { name: String },
}

pub fn default_scan_excluded_directory_names() -> Vec<String> {
    vec!["plan-review".to_string(), "user-review".to_string()]
}

fn plugin_workspace_default_file_name(key: SpecFileKey) -> &'static str {
    match key {
        SpecFileKey::Exploration => "exploration-report.md",
        SpecFileKey::Hearing => "hearing-notes.md",
        SpecFileKey::Impl => "implementation-plan.md",
        SpecFileKey::Tasks => "tasks.md",
        SpecFileKey::Requirements => "requirements.html",
        SpecFileKey::TechReference => "tech-reference.html",
        SpecFileKey::TestCases => "test-cases.html",
        SpecFileKey::Design => "design.md",
    }
}

fn validate_scan_excluded_directory_names(
    names: Vec<String>,
) -> Result<Vec<String>, WorkspaceConfigError> {
    let mut normalized = Vec::with_capacity(names.len());

    for name in names {
        let trimmed = name.trim();

        if trimmed.is_empty()
            || matches!(trimmed, "." | "..")
            || trimmed.contains('/')
            || trimmed.contains('\\')
            || trimmed.contains('\0')
        {
            return Err(WorkspaceConfigError::UnsafeScanExcludedDirectoryName { name });
        }

        normalized.push(trimmed.to_string());
    }

    Ok(normalized)
}

fn spec_skill_default_file_name(key: SpecFileKey) -> &'static str {
    match key {
        SpecFileKey::Requirements => "requirements.md",
        SpecFileKey::Design => "design.md",
        SpecFileKey::Tasks => "tasks.md",
        SpecFileKey::TechReference => "tech-reference.html",
        SpecFileKey::TestCases => "test-cases.html",
        SpecFileKey::Exploration => "exploration-report.md",
        SpecFileKey::Hearing => "hearing-notes.md",
        SpecFileKey::Impl => "implementation-plan.md",
    }
}

fn validate_safe_file_name(key: SpecFileKey, file_name: &str) -> Result<(), WorkspaceConfigError> {
    if file_name.is_empty()
        || matches!(file_name, "." | "..")
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.contains('\0')
    {
        return Err(WorkspaceConfigError::UnsafeFileName {
            key,
            file_name: file_name.to_string(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mapping(
        key: SpecFileKey,
        file_name: &str,
    ) -> Result<WorkspaceFileMapping, WorkspaceConfigError> {
        WorkspaceFileMapping::new(key, file_name)
    }

    #[test]
    fn workspace_config_defaults_plugin_workspace_files_in_tab_order() {
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

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
            ],
            files
        );
        assert_eq!(
            vec!["plan-review".to_string(), "user-review".to_string()],
            config.scan_excluded_directory_names()
        );
    }

    #[test]
    fn workspace_config_defaults_spec_skill_files_in_tab_order() {
        let config = WorkspaceConfig::default_for(WorkspaceKind::SpecSkill);

        let files: Vec<(SpecFileKey, &str)> = config
            .files()
            .iter()
            .map(|file| (file.key(), file.file_name()))
            .collect();

        assert_eq!(
            vec![
                (SpecFileKey::Requirements, "requirements.md"),
                (SpecFileKey::Design, "design.md"),
                (SpecFileKey::Tasks, "tasks.md"),
            ],
            files
        );
    }

    #[test]
    fn workspace_config_accepts_empty_scan_exclusions_to_restore_recursive_scan() {
        let config = WorkspaceConfig::with_scan_excluded_directory_names(
            vec![mapping(SpecFileKey::Tasks, "tasks.md").expect("mapping should be valid")],
            Vec::new(),
        )
        .expect("empty scan exclusions should be valid");

        assert!(config.scan_excluded_directory_names().is_empty());
    }

    #[test]
    fn workspace_config_rejects_nested_scan_exclusion_names() {
        let result = WorkspaceConfig::with_scan_excluded_directory_names(
            vec![mapping(SpecFileKey::Tasks, "tasks.md").expect("mapping should be valid")],
            vec!["plan-review/nested".to_string()],
        );

        assert!(matches!(
            result,
            Err(WorkspaceConfigError::UnsafeScanExcludedDirectoryName { name })
                if name == "plan-review/nested"
        ));
    }

    #[test]
    fn workspace_config_merge_overrides_default_file_names_and_appends_new_keys() {
        let defaults = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
        let user_config = WorkspaceConfig::new(vec![
            mapping(SpecFileKey::Hearing, "interview.md").expect("mapping should be valid"),
            mapping(SpecFileKey::Design, "design.md").expect("mapping should be valid"),
        ])
        .expect("config should be valid");

        let merged = defaults.merge_user_config(user_config);

        let files: Vec<(SpecFileKey, &str)> = merged
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
                (SpecFileKey::Hearing, "interview.md"),
                (SpecFileKey::Design, "design.md"),
            ],
            files
        );
    }

    #[test]
    fn workspace_config_tracks_file_mapping_sources() {
        let defaults = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
        let user_config = WorkspaceConfig::new(vec![
            mapping(SpecFileKey::Tasks, "todo.md").expect("mapping should be valid")
        ])
        .expect("config should be valid");

        let merged = defaults.merge_user_config(user_config);

        assert_eq!(
            Some(WorkspaceConfigSource::Default),
            merged
                .file_for_key(SpecFileKey::Exploration)
                .map(WorkspaceFileMapping::source)
        );
        assert_eq!(
            Some(WorkspaceConfigSource::WorkspaceConfig),
            merged
                .file_for_key(SpecFileKey::Tasks)
                .map(WorkspaceFileMapping::source)
        );
    }

    #[test]
    fn workspace_config_merges_spec_override_after_workspace_config() {
        let defaults = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);
        let user_config = WorkspaceConfig::new(vec![
            mapping(SpecFileKey::Tasks, "todo.md").expect("mapping should be valid")
        ])
        .expect("config should be valid");
        let spec_override = SpecConfigOverride::new(vec![WorkspaceFileMapping::with_source(
            SpecFileKey::Tasks,
            "local-tasks.md",
            WorkspaceConfigSource::SpecOverride,
        )
        .expect("mapping should be valid")])
        .expect("override should be valid");

        let merged = defaults
            .merge_user_config(user_config)
            .merge_spec_override(&spec_override);

        assert_eq!(
            Some("local-tasks.md"),
            merged
                .file_for_key(SpecFileKey::Tasks)
                .map(WorkspaceFileMapping::file_name)
        );
        assert_eq!(
            Some(WorkspaceConfigSource::SpecOverride),
            merged
                .file_for_key(SpecFileKey::Tasks)
                .map(WorkspaceFileMapping::source)
        );
    }

    #[test]
    fn workspace_config_rejects_duplicate_logical_file_keys() {
        let result = WorkspaceConfig::new(vec![
            mapping(SpecFileKey::Tasks, "tasks.md").expect("mapping should be valid"),
            mapping(SpecFileKey::Tasks, "todo.md").expect("mapping should be valid"),
        ]);

        assert_eq!(
            Err(WorkspaceConfigError::DuplicateFileKey {
                key: SpecFileKey::Tasks
            }),
            result
        );
    }

    #[test]
    fn workspace_file_mapping_trims_file_name() {
        let file = mapping(SpecFileKey::Tasks, "  tasks.md  ").expect("mapping should be valid");

        assert_eq!("tasks.md", file.file_name());
    }

    #[test]
    fn workspace_file_mapping_rejects_empty_file_name() {
        let result = mapping(SpecFileKey::Tasks, "   ");

        assert_eq!(
            Err(WorkspaceConfigError::MissingFileName {
                key: SpecFileKey::Tasks
            }),
            result
        );
    }

    #[test]
    fn workspace_file_mapping_rejects_parent_path_traversal() {
        let result = mapping(SpecFileKey::Tasks, "../tasks.md");

        assert_eq!(
            Err(WorkspaceConfigError::UnsafeFileName {
                key: SpecFileKey::Tasks,
                file_name: "../tasks.md".to_string(),
            }),
            result
        );
    }

    #[test]
    fn workspace_file_mapping_rejects_nested_paths() {
        let result = mapping(SpecFileKey::Tasks, "docs/tasks.md");

        assert_eq!(
            Err(WorkspaceConfigError::UnsafeFileName {
                key: SpecFileKey::Tasks,
                file_name: "docs/tasks.md".to_string(),
            }),
            result
        );
    }

    #[test]
    fn workspace_file_mapping_rejects_absolute_paths() {
        let result = mapping(SpecFileKey::Tasks, "/tmp/tasks.md");

        assert_eq!(
            Err(WorkspaceConfigError::UnsafeFileName {
                key: SpecFileKey::Tasks,
                file_name: "/tmp/tasks.md".to_string(),
            }),
            result
        );
    }

    #[test]
    fn workspace_config_finds_mapping_by_logical_key() {
        let config = WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace);

        let file = config
            .file_for_key(SpecFileKey::Impl)
            .expect("impl mapping should exist");

        assert_eq!("implementation-plan.md", file.file_name());
    }
}
