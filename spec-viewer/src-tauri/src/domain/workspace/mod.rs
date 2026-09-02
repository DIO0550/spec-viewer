//! Workspace domain concepts.

use std::fmt;

use thiserror::Error;

mod config;

pub use config::{
    default_scan_excluded_directory_names, SpecConfigOverride, WorkspaceConfig,
    WorkspaceConfigError, WorkspaceConfigSource, WorkspaceFileMapping,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct WorkspaceRelativePath {
    value: String,
}

impl WorkspaceRelativePath {
    pub fn new(value: impl Into<String>) -> Result<Self, WorkspaceDomainError> {
        Self::try_from(value.into())
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl TryFrom<String> for WorkspaceRelativePath {
    type Error = WorkspaceDomainError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        let violation = value.split('/').find_map(|segment| match segment {
            "" => Some(RelativePathViolation::EmptySegment),
            "." => Some(RelativePathViolation::CurrentDirectorySegment),
            ".." => Some(RelativePathViolation::ParentDirectorySegment),
            _ => segment
                .chars()
                .find(|character| matches!(character, '\\' | '\0' | ':'))
                .map(|character| RelativePathViolation::ForbiddenCharacter { character }),
        });

        match violation {
            Some(violation) => Err(WorkspaceDomainError::InvalidRelativePath { value, violation }),
            None => Ok(Self { value }),
        }
    }
}

impl fmt::Display for WorkspaceRelativePath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct WorkspaceRoot {
    value: String,
}

impl WorkspaceRoot {
    pub fn new(value: impl Into<String>) -> Result<Self, WorkspaceDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() {
            return Err(WorkspaceDomainError::MissingRoot);
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for WorkspaceRoot {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum WorkspaceKind {
    PluginWorkspace,
    PluginWorktree,
    SpecSkill,
}

impl WorkspaceKind {
    pub fn from_identifier(value: &str) -> Result<Self, WorkspaceDomainError> {
        match value {
            "plugin-workspace" => Ok(Self::PluginWorkspace),
            "plugin-worktree" => Ok(Self::PluginWorktree),
            "spec-skill" => Ok(Self::SpecSkill),
            _ => Err(WorkspaceDomainError::UnsupportedLayout {
                layout: value.to_string(),
            }),
        }
    }

    pub fn identifier(self) -> &'static str {
        match self {
            Self::PluginWorkspace => "plugin-workspace",
            Self::PluginWorktree => "plugin-worktree",
            Self::SpecSkill => "spec-skill",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceLayout {
    root: WorkspaceRoot,
    kind: WorkspaceKind,
}

impl WorkspaceLayout {
    pub fn new(root: WorkspaceRoot, kind: WorkspaceKind) -> Self {
        Self { root, kind }
    }

    pub fn plugin_workspace(root: WorkspaceRoot) -> Self {
        Self::new(root, WorkspaceKind::PluginWorkspace)
    }

    pub fn plugin_worktree(root: WorkspaceRoot) -> Self {
        Self::new(root, WorkspaceKind::PluginWorktree)
    }

    pub fn spec_skill(root: WorkspaceRoot) -> Self {
        Self::new(root, WorkspaceKind::SpecSkill)
    }

    pub fn root(&self) -> &WorkspaceRoot {
        &self.root
    }

    pub fn kind(&self) -> WorkspaceKind {
        self.kind
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RelativePathViolation {
    #[error("contains an empty path segment")]
    EmptySegment,
    #[error("contains a current-directory segment")]
    CurrentDirectorySegment,
    #[error("contains a parent-directory segment")]
    ParentDirectorySegment,
    #[error("contains forbidden character {character:?}")]
    ForbiddenCharacter { character: char },
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum WorkspaceDomainError {
    #[error("workspace-relative path is invalid: {value}: {violation}")]
    InvalidRelativePath {
        value: String,
        violation: RelativePathViolation,
    },
    #[error("workspace root is required")]
    MissingRoot,
    #[error("unsupported workspace layout: {layout}")]
    UnsupportedLayout { layout: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_root_accepts_non_empty_value() {
        let root = WorkspaceRoot::new("/workspace/example").expect("root should be valid");

        assert_eq!("/workspace/example", root.as_str());
    }

    #[test]
    fn workspace_root_trims_surrounding_whitespace() {
        let root = WorkspaceRoot::new("  /workspace/example  ").expect("root should be valid");

        assert_eq!("/workspace/example", root.as_str());
    }

    #[test]
    fn workspace_root_rejects_empty_value() {
        let result = WorkspaceRoot::new("   ");

        assert_eq!(Err(WorkspaceDomainError::MissingRoot), result);
    }

    #[test]
    fn workspace_kind_accepts_supported_identifiers() {
        assert_eq!(
            Ok(WorkspaceKind::PluginWorkspace),
            WorkspaceKind::from_identifier("plugin-workspace")
        );
        assert_eq!(
            Ok(WorkspaceKind::PluginWorktree),
            WorkspaceKind::from_identifier("plugin-worktree")
        );
        assert_eq!(
            Ok(WorkspaceKind::SpecSkill),
            WorkspaceKind::from_identifier("spec-skill")
        );
    }

    #[test]
    fn workspace_kind_rejects_unsupported_identifier() {
        let result = WorkspaceKind::from_identifier("other");

        assert_eq!(
            Err(WorkspaceDomainError::UnsupportedLayout {
                layout: "other".to_string()
            }),
            result
        );
    }

    #[test]
    fn workspace_layout_keeps_root_and_kind() {
        let root = WorkspaceRoot::new("/workspace/example").expect("root should be valid");
        let layout = WorkspaceLayout::plugin_workspace(root);

        assert_eq!("/workspace/example", layout.root().as_str());
        assert_eq!(WorkspaceKind::PluginWorkspace, layout.kind());
    }
}
