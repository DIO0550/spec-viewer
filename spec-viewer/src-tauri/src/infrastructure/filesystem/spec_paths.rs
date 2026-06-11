//! Resolution of spec ids to absolute workspace paths.

use std::path::PathBuf;

use crate::domain::{
    spec::{SafeSpecPath, SafeSpecPathError},
    workspace::WorkspaceLayout,
};

use super::conventions::SpecLayoutConvention;

/// Resolves spec ids and workspace layouts to filesystem locations.
#[derive(Debug, Clone, Copy, Default)]
pub struct SpecPathResolver;

impl SpecPathResolver {
    pub fn spec_root_path(layout: &WorkspaceLayout) -> PathBuf {
        PathBuf::from(layout.root().as_str()).join(
            SpecLayoutConvention::spec_root_directory_for_kind(layout.kind()),
        )
    }

    pub fn spec_directory_path(
        layout: &WorkspaceLayout,
        spec_id: &str,
    ) -> Result<PathBuf, SafeSpecPathError> {
        let relative_spec_path = SafeSpecPath::parse(spec_id)?.into_path_buf();

        if let Ok(path_under_source_group) = relative_spec_path.strip_prefix(
            SpecLayoutConvention::spec_root_directory_for_kind(layout.kind()),
        ) {
            return Ok(Self::spec_root_path(layout).join(path_under_source_group));
        }

        if SpecLayoutConvention::is_claude_plugin_worktree_spec_path(&relative_spec_path) {
            return Ok(PathBuf::from(layout.root().as_str()).join(relative_spec_path));
        }

        Ok(Self::spec_root_path(layout).join(relative_spec_path))
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::TestWorkspace;
    use super::*;
    use crate::domain::workspace::WorkspaceKind;

    #[test]
    fn spec_directory_path_resolves_claude_plugin_worktree_spec_ids() {
        let workspace = TestWorkspace::new("claude-worktree-spec-path");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let path = SpecPathResolver::spec_directory_path(
            &layout,
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth",
        )
        .expect("worktree spec id should resolve");

        assert_eq!(
            workspace
                .root()
                .join(".claude/worktrees/feature-auth/.plugin-worktree/.specs/auth"),
            path
        );
    }

    #[test]
    fn spec_directory_path_resolves_claude_plugin_workspace_spec_ids() {
        let workspace = TestWorkspace::new("claude-plugin-workspace-spec-path");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let path = SpecPathResolver::spec_directory_path(
            &layout,
            ".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments",
        )
        .expect("plugin workspace spec id should resolve");

        assert_eq!(
            workspace
                .root()
                .join(".claude/worktrees/doccom-be/.plugin-workspace/.specs/019-be-doc-comments"),
            path
        );
    }

    #[test]
    fn spec_directory_path_resolves_root_plugin_workspace_source_group_spec_ids() {
        let workspace = TestWorkspace::new("root-plugin-workspace-source-group-spec-path");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        let path = SpecPathResolver::spec_directory_path(&layout, ".plugin-workspace/.specs/auth")
            .expect("root source group spec id should resolve");

        assert_eq!(workspace.root().join(".plugin-workspace/.specs/auth"), path);
    }
}
