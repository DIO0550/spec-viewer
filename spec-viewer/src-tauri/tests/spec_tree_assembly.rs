use spec_reviewer_lib::domain::{
    spec::{
        SpecDirectoryFact, SpecDocumentFormat, SpecFileFact, SpecFileKey, SpecFileStatus, SpecId,
        SpecNodeKind, SpecRootFact, SpecTreeAssembler, SpecTreeFacts,
    },
    workspace::{WorkspaceConfig, WorkspaceConfigSource, WorkspaceKind, WorkspaceTopology},
};

fn file_fact() -> SpecFileFact {
    SpecFileFact::new(
        SpecFileKey::Tasks,
        "tasks.md",
        SpecFileStatus::Present,
        SpecDocumentFormat::Markdown,
        WorkspaceConfigSource::Default,
    )
}

fn directory(name: &str) -> SpecDirectoryFact {
    SpecDirectoryFact::new(name, vec![file_fact()], Vec::new())
}

#[test]
fn assembler_owns_source_groups_ids_capabilities_exclusions_and_order() {
    let config = WorkspaceConfig::with_scan_excluded_directory_names(
        Vec::new(),
        vec!["generated".to_string()],
    )
    .expect("config should be valid");
    let facts = SpecTreeFacts::new(vec![
        SpecRootFact::new(
            ".claude/worktrees/feature-z/.plugin-workspace/.specs",
            vec![
                directory("zeta"),
                SpecDirectoryFact::new("empty", Vec::new(), Vec::new()),
                directory("alpha"),
            ],
        ),
        SpecRootFact::new(
            ".plugin-workspace/.specs",
            vec![
                directory("zeta"),
                directory(".hidden"),
                directory("generated"),
                SpecDirectoryFact::new("alpha", vec![file_fact()], vec![directory("nested")]),
            ],
        ),
    ]);

    let tree = SpecTreeAssembler::new(WorkspaceTopology::default())
        .assemble(WorkspaceKind::PluginWorkspace, &config, facts)
        .expect("facts should assemble");

    assert_eq!(
        vec![
            ".plugin-workspace/.specs",
            ".claude/worktrees/feature-z/.plugin-workspace/.specs",
        ],
        tree.roots()
            .iter()
            .map(|node| node.id().as_str())
            .collect::<Vec<_>>()
    );

    let primary = &tree.roots()[0];
    assert_eq!(SpecNodeKind::SourceGroup, primary.kind());
    assert_eq!("ルート", primary.label());
    assert!(!primary.is_reviewable());
    assert!(!primary.is_archiveable());
    assert_eq!(
        vec![
            ".plugin-workspace/.specs/alpha",
            ".plugin-workspace/.specs/zeta",
        ],
        primary
            .children()
            .iter()
            .map(|node| node.id().as_str())
            .collect::<Vec<_>>()
    );

    let alpha_id =
        SpecId::new(".plugin-workspace/.specs/alpha").expect("assembled id should be valid");
    let alpha = tree.find(&alpha_id).expect("nested spec should be found");
    assert_eq!(SpecNodeKind::Spec, alpha.kind());
    assert!(alpha.is_reviewable());
    assert!(alpha.is_archiveable());
    assert_eq!(
        ".plugin-workspace/.specs/alpha/nested",
        alpha.children()[0].id().as_str()
    );
    let empty_id = SpecId::new(".claude/worktrees/feature-z/.plugin-workspace/.specs/empty")
        .expect("assembled id should be valid");
    let empty = tree.find(&empty_id).expect("empty spec should be found");
    assert!(!empty.is_reviewable());
    assert!(empty.is_archiveable());

    assert_eq!(
        vec![
            ".plugin-workspace/.specs/alpha",
            ".plugin-workspace/.specs/alpha/nested",
            ".plugin-workspace/.specs/zeta",
            ".claude/worktrees/feature-z/.plugin-workspace/.specs/alpha",
            ".claude/worktrees/feature-z/.plugin-workspace/.specs/zeta",
        ],
        tree.reviewable_nodes()
            .map(|node| node.id().as_str())
            .collect::<Vec<_>>()
    );
}
