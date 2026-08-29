//! Workspace domain concepts.

use std::fmt;

use thiserror::Error;

mod config;

pub use config::{
    default_scan_excluded_directory_names, SpecConfigOverride, SpecOverrideNodeKind,
    WorkspaceConfig, WorkspaceConfigError, WorkspaceConfigSource, WorkspaceFileMapping,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct WorktreeId {
    value: String,
}

impl WorktreeId {
    pub fn new(value: impl Into<String>) -> Result<Self, WorkspaceDomainError> {
        let value = value.into();
        if value.trim().is_empty() {
            return Err(WorkspaceDomainError::MissingWorktreeId);
        }
        Ok(Self { value })
    }
    pub fn as_str(&self) -> &str {
        &self.value
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ValidatedRefName {
    value: String,
}

impl ValidatedRefName {
    pub fn parse(value: impl Into<String>) -> Result<Self, WorkspaceDomainError> {
        let value = value.into();
        let invalid = value.trim() != value
            || value.is_empty()
            || value == "@"
            || value.chars().any(char::is_whitespace)
            || value.starts_with('-')
            || value
                .bytes()
                .any(|byte| byte == 0 || byte < 0x20 || byte == 0x7f)
            || value
                .chars()
                .any(|character| matches!(character, '~' | '^' | ':' | '?' | '*' | '[' | '\\'))
            || value.contains("..")
            || value.contains("@{")
            || value.contains("//")
            || value
                .split('/')
                .any(|segment| segment.is_empty() || segment.starts_with('.'))
            || value.ends_with('.')
            || value.ends_with('/')
            || value.ends_with(".lock");
        if invalid {
            return Err(WorkspaceDomainError::InvalidRefName { value });
        }
        Ok(Self { value })
    }
    pub fn as_str(&self) -> &str {
        &self.value
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
}

impl WorkspaceKind {
    pub fn from_identifier(value: &str) -> Result<Self, WorkspaceDomainError> {
        match value {
            "plugin-workspace" => Ok(Self::PluginWorkspace),
            "plugin-worktree" => Ok(Self::PluginWorktree),
            _ => Err(WorkspaceDomainError::UnsupportedLayout {
                layout: value.to_string(),
            }),
        }
    }

    pub fn identifier(self) -> &'static str {
        match self {
            Self::PluginWorkspace => "plugin-workspace",
            Self::PluginWorktree => "plugin-worktree",
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

    pub fn root(&self) -> &WorkspaceRoot {
        &self.root
    }

    pub fn kind(&self) -> WorkspaceKind {
        self.kind
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum WorkspaceDomainError {
    #[error("workspace root is required")]
    MissingRoot,
    #[error("worktree id is required")]
    MissingWorktreeId,
    #[error("invalid git ref name: {value}")]
    InvalidRefName { value: String },
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
    fn worktree_and_ref_value_objects_enforce_boundaries() {
        assert_eq!(
            WorktreeId::new(" ").unwrap_err(),
            WorkspaceDomainError::MissingWorktreeId
        );
        assert_eq!(
            WorktreeId::new("worktree-1").unwrap().as_str(),
            "worktree-1"
        );
        assert_eq!(
            ValidatedRefName::parse("feature/review").unwrap().as_str(),
            "feature/review"
        );
        for invalid in [
            "", " branch", "-option", "a..b", "a@{b", "a//b", "a/", "a.", "a.lock", "a/\u{0}b",
        ] {
            assert!(
                matches!(
                    ValidatedRefName::parse(invalid),
                    Err(WorkspaceDomainError::InvalidRefName { .. })
                ),
                "{invalid:?} must be rejected"
            );
        }
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
