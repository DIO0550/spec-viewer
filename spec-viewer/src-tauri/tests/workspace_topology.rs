use spec_reviewer_lib::domain::workspace::{
    WorkspaceDetectionMode, WorkspaceKind, WorkspaceTopology,
};

#[test]
fn workspace_topology_exposes_detection_precedence_without_filesystem_paths() {
    let topology = WorkspaceTopology::default();
    let actual = topology
        .detection_precedence()
        .iter()
        .map(|rule| {
            (
                rule.kind(),
                rule.mode(),
                rule.marker().as_str(),
                rule.required_directory_name(),
            )
        })
        .collect::<Vec<_>>();

    assert_eq!(
        vec![
            (
                WorkspaceKind::PluginWorkspace,
                WorkspaceDetectionMode::Marker,
                ".plugin-workspace/.specs",
                None,
            ),
            (
                WorkspaceKind::PluginWorktree,
                WorkspaceDetectionMode::NamedDirectoryMarker,
                ".specs",
                Some(".plugin-worktree"),
            ),
            (
                WorkspaceKind::PluginWorkspace,
                WorkspaceDetectionMode::ClaudeWorktreeCollection,
                ".claude/worktrees",
                None,
            ),
            (
                WorkspaceKind::SpecSkill,
                WorkspaceDetectionMode::Marker,
                ".spec-skill/features",
                None,
            ),
        ],
        actual
    );
}

#[test]
fn workspace_topology_describes_primary_and_worktree_spec_sources() {
    let topology = WorkspaceTopology::default();

    assert_eq!(
        ".plugin-workspace/.specs",
        topology
            .primary_spec_root(WorkspaceKind::PluginWorkspace)
            .as_str()
    );
    assert_eq!(
        ".specs",
        topology
            .primary_spec_root(WorkspaceKind::PluginWorktree)
            .as_str()
    );
    assert_eq!(
        ".spec-skill/features",
        topology
            .primary_spec_root(WorkspaceKind::SpecSkill)
            .as_str()
    );

    let primary = topology
        .source_group_for_root(WorkspaceKind::PluginWorkspace, ".plugin-workspace/.specs")
        .expect("plugin workspace root should be grouped");
    assert_eq!(".plugin-workspace/.specs", primary.id_prefix());
    assert_eq!("ルート", primary.label());

    let worktree = topology
        .source_group_for_root(
            WorkspaceKind::PluginWorkspace,
            ".claude/worktrees/feature-auth/.plugin-worktree/.specs",
        )
        .expect("Claude worktree root should be grouped");
    assert_eq!(
        ".claude/worktrees/feature-auth/.plugin-worktree/.specs",
        worktree.id_prefix()
    );
    assert_eq!("feature-auth (.plugin-worktree)", worktree.label());
}
