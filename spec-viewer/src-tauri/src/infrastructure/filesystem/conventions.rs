//! Workspace layout conventions shared by the filesystem adapters.

use std::path::{Path, PathBuf};

use crate::domain::workspace::WorkspaceKind;

pub(crate) const PLUGIN_WORKSPACE_SPECS_DIR: &str = ".plugin-workspace/.specs";
pub(crate) const PLUGIN_WORKSPACE_DIRECTORY: &str = ".plugin-workspace";
pub(crate) const PLUGIN_WORKTREE_DIRECTORY: &str = ".plugin-worktree";
pub(crate) const PLUGIN_WORKTREE_SPECS_DIR: &str = ".specs";
pub(crate) const CLAUDE_WORKTREES_DIR: &str = ".claude/worktrees";
pub(crate) const SPEC_SKILL_FEATURES_DIR: &str = ".spec-skill/features";
pub(crate) const SPEC_ARCHIVE_DIRECTORY: &str = ".archive";
pub(crate) const CLAUDE_WORKTREE_SPEC_CONTAINERS: [&str; 2] =
    [PLUGIN_WORKTREE_DIRECTORY, PLUGIN_WORKSPACE_DIRECTORY];

/// Pure naming and placement rules of supported workspace layouts.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct SpecLayoutConvention;

impl SpecLayoutConvention {
    pub(crate) fn spec_root_directory_for_kind(kind: WorkspaceKind) -> &'static str {
        match kind {
            WorkspaceKind::PluginWorkspace => PLUGIN_WORKSPACE_SPECS_DIR,
            WorkspaceKind::PluginWorktree => PLUGIN_WORKTREE_SPECS_DIR,
            WorkspaceKind::SpecSkill => SPEC_SKILL_FEATURES_DIR,
        }
    }

    pub(crate) fn primary_source_group_for_kind(
        kind: WorkspaceKind,
    ) -> Option<(&'static str, &'static str)> {
        match kind {
            WorkspaceKind::PluginWorkspace => Some((PLUGIN_WORKSPACE_SPECS_DIR, "ルート")),
            WorkspaceKind::PluginWorktree | WorkspaceKind::SpecSkill => None,
        }
    }

    pub(crate) fn is_plugin_worktree_directory(path: &Path) -> bool {
        path.file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name == PLUGIN_WORKTREE_DIRECTORY)
    }

    pub(crate) fn is_claude_plugin_worktree_spec_path(relative_spec_path: &Path) -> bool {
        let components = Self::relative_spec_path_components(relative_spec_path);

        matches!(
            components.as_slice(),
            [
                claude,
                worktrees,
                worktree_name,
                plugin_container,
                specs,
                ..
            ] if claude == ".claude"
                && worktrees == "worktrees"
                && !worktree_name.is_empty()
                && CLAUDE_WORKTREE_SPEC_CONTAINERS.contains(&plugin_container.as_str())
                && specs == PLUGIN_WORKTREE_SPECS_DIR
                && components.len() > 5
        )
    }

    pub(crate) fn claude_plugin_worktree_source_root(relative_spec_path: &Path) -> Option<PathBuf> {
        let components = Self::relative_spec_path_components(relative_spec_path);

        if !matches!(
            components.as_slice(),
            [claude, worktrees, worktree_name, plugin_container, specs, ..]
                if claude == ".claude"
                    && worktrees == "worktrees"
                    && !worktree_name.is_empty()
                    && CLAUDE_WORKTREE_SPEC_CONTAINERS.contains(&plugin_container.as_str())
                    && specs == PLUGIN_WORKTREE_SPECS_DIR
        ) {
            return None;
        }

        let mut source_root = PathBuf::new();

        for component in components.iter().take(5) {
            source_root.push(component);
        }

        Some(source_root)
    }

    fn relative_spec_path_components(relative_spec_path: &Path) -> Vec<String> {
        let components: Vec<String> = relative_spec_path
            .components()
            .map(|component| component.as_os_str().to_string_lossy().into_owned())
            .collect();

        components
    }
}

pub(crate) fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
