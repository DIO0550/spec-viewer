//! Workspace config domain concepts.

use std::{
    collections::HashSet,
    path::{Component, Path},
};

use thiserror::Error;

use crate::domain::spec::SpecFileKey;

use super::WorkspaceKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceFileMapping {
    key: SpecFileKey,
    file_name: String,
}

impl WorkspaceFileMapping {
    pub fn new(
        key: SpecFileKey,
        file_name: impl Into<String>,
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
        })
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn file_name(&self) -> &str {
        &self.file_name
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceConfig {
    files: Vec<WorkspaceFileMapping>,
}

impl WorkspaceConfig {
    pub fn new(files: Vec<WorkspaceFileMapping>) -> Result<Self, WorkspaceConfigError> {
        let mut seen_keys = HashSet::new();

        for file in &files {
            if !seen_keys.insert(file.key()) {
                return Err(WorkspaceConfigError::DuplicateFileKey { key: file.key() });
            }
        }

        Ok(Self { files })
    }

    pub fn default_for(kind: WorkspaceKind) -> Self {
        match kind {
            WorkspaceKind::PluginWorkspace => Self::plugin_workspace_default(),
            WorkspaceKind::SpecSkill => Self::spec_skill_default(),
        }
    }

    pub fn plugin_workspace_default() -> Self {
        Self::from_default_keys(SpecFileKey::default_keys())
    }

    pub fn spec_skill_default() -> Self {
        Self::from_default_keys(SpecFileKey::compatibility_keys())
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

        Self { files }
    }

    pub fn files(&self) -> &[WorkspaceFileMapping] {
        &self.files
    }

    pub fn file_for_key(&self, key: SpecFileKey) -> Option<&WorkspaceFileMapping> {
        self.files.iter().find(|file| file.key() == key)
    }

    fn from_default_keys(keys: &[SpecFileKey]) -> Self {
        let files = keys
            .iter()
            .map(|key| {
                WorkspaceFileMapping::new(*key, default_file_name_for_key(*key))
                    .expect("workspace default file names should be valid")
            })
            .collect();

        Self::new(files).expect("workspace default keys should be unique")
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
}

fn default_file_name_for_key(key: SpecFileKey) -> String {
    format!("{}.md", key.as_str())
}

fn validate_safe_file_name(key: SpecFileKey, file_name: &str) -> Result<(), WorkspaceConfigError> {
    let is_single_plain_name = matches!(
        Path::new(file_name)
            .components()
            .collect::<Vec<Component<'_>>>()
            .as_slice(),
        [Component::Normal(_)]
    );

    if !is_single_plain_name
        || Path::new(file_name).is_absolute()
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
                (SpecFileKey::Exploration, "exploration.md"),
                (SpecFileKey::Hearing, "hearing.md"),
                (SpecFileKey::Impl, "impl.md"),
                (SpecFileKey::Tasks, "tasks.md"),
            ],
            files
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
                (SpecFileKey::Exploration, "exploration.md"),
                (SpecFileKey::Hearing, "interview.md"),
                (SpecFileKey::Impl, "impl.md"),
                (SpecFileKey::Tasks, "tasks.md"),
                (SpecFileKey::Design, "design.md"),
            ],
            files
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

        assert_eq!("impl.md", file.file_name());
    }
}
