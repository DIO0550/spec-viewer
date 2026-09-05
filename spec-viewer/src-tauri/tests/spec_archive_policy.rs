use spec_reviewer_lib::domain::{
    spec::{
        SpecArchivePolicy, SpecArchivePolicyError, SpecFile, SpecFileKey, SpecFileStatus, SpecId,
        SpecNode, SpecNodeIdentity, SpecTree,
    },
    workspace::{WorkspaceKind, WorkspaceTopology},
};

const PRIMARY_ROOT: &str = ".plugin-workspace/.specs";

fn spec_id(value: &str) -> SpecId {
    SpecId::new(value).expect("spec id should be valid")
}

fn identity(source_group_id: &str, relative_id: &str) -> SpecNodeIdentity {
    SpecNodeIdentity::new(source_group_id, relative_id).expect("identity should be valid")
}

fn present_tasks() -> Vec<SpecFile> {
    vec![
        SpecFile::new(SpecFileKey::Tasks, "tasks.md", SpecFileStatus::Present)
            .expect("file fixture should be valid"),
    ]
}

fn spec(relative_id: &str, files: Vec<SpecFile>, children: Vec<SpecNode>) -> SpecNode {
    SpecNode::spec(
        identity(PRIMARY_ROOT, relative_id),
        relative_id,
        files,
        children,
    )
    .expect("spec fixture should be valid")
}

fn policy_tree() -> SpecTree {
    let auth = spec("auth", present_tasks(), Vec::new());
    let empty = spec("empty", Vec::new(), Vec::new());
    let child = spec("container/child", present_tasks(), Vec::new());
    let container = spec("container", Vec::new(), vec![child]);

    SpecTree::new(vec![auth, container, empty])
}

fn policy_result(
    tree: &SpecTree,
    requested: &SpecId,
) -> Result<spec_reviewer_lib::domain::spec::SpecArchiveTarget, SpecArchivePolicyError> {
    SpecArchivePolicy.target_for(
        tree,
        &WorkspaceTopology::default(),
        WorkspaceKind::PluginWorkspace,
        requested,
    )
}

#[test]
fn policy_returns_target_only_for_reviewable_scanned_spec() {
    let tree = policy_tree();
    let requested = spec_id(".plugin-workspace/.specs/auth");

    let target =
        policy_result(&tree, &requested).expect("reviewable scanned spec should be archiveable");

    assert_eq!(&requested, target.spec_id());
}

#[test]
fn policy_rejects_non_reviewable_empty_leaf() {
    let tree = policy_tree();
    let requested = spec_id(".plugin-workspace/.specs/empty");

    assert_eq!(
        Err(SpecArchivePolicyError::NotArchiveable {
            spec_id: requested.clone(),
        }),
        policy_result(&tree, &requested)
    );
}

#[test]
fn policy_distinguishes_source_group_container_and_unknown_id() {
    let tree = policy_tree();
    let source_group = spec_id(PRIMARY_ROOT);
    let container = spec_id(".plugin-workspace/.specs/container");
    let unknown = spec_id(".plugin-workspace/.specs/missing");

    assert_eq!(
        Err(SpecArchivePolicyError::SourceGroup {
            spec_id: source_group.clone(),
        }),
        policy_result(&tree, &source_group)
    );
    assert_eq!(
        Err(SpecArchivePolicyError::Container {
            spec_id: container.clone(),
        }),
        policy_result(&tree, &container)
    );
    assert_eq!(
        Err(SpecArchivePolicyError::UnknownSpec {
            spec_id: unknown.clone(),
        }),
        policy_result(&tree, &unknown)
    );
}

#[test]
fn policy_classifies_strict_ancestor_without_a_tree_node_as_container() {
    let tree = policy_tree();
    let requested = spec_id(".plugin-workspace");

    assert_eq!(
        Err(SpecArchivePolicyError::Container {
            spec_id: requested.clone(),
        }),
        policy_result(&tree, &requested)
    );
}

#[test]
fn policy_recognizes_flattened_primary_roots_as_source_groups() {
    let topology = WorkspaceTopology::default();
    let tree = SpecTree::default();

    for (kind, root) in [
        (WorkspaceKind::PluginWorktree, ".specs"),
        (WorkspaceKind::SpecSkill, ".spec-skill/features"),
    ] {
        let requested = spec_id(root);

        assert_eq!(
            Err(SpecArchivePolicyError::SourceGroup {
                spec_id: requested.clone(),
            }),
            SpecArchivePolicy.target_for(&tree, &topology, kind, &requested)
        );
    }
}

#[test]
fn policy_rejects_secondary_claude_worktree_source_group() {
    let topology = WorkspaceTopology::default();
    let requested = spec_id(".claude/worktrees/feature-auth/.plugin-workspace/.specs");
    let source_group = SpecNode::source_group(
        identity(requested.as_str(), "."),
        "feature-auth (.plugin-workspace)",
        Vec::new(),
    )
    .expect("source group fixture should be valid");
    let tree = SpecTree::new(vec![source_group]);

    assert_eq!(
        Err(SpecArchivePolicyError::SourceGroup {
            spec_id: requested.clone(),
        }),
        SpecArchivePolicy.target_for(&tree, &topology, WorkspaceKind::PluginWorkspace, &requested,)
    );
}
