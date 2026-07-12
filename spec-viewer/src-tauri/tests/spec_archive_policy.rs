use spec_reviewer_lib::domain::spec::{
    SpecArchivePolicy, SpecArchivePolicyError, SpecId, SpecNode, SpecTree,
};

fn spec_id(value: &str) -> SpecId {
    SpecId::new(value).expect("spec id should be valid")
}

fn scanned_tree() -> SpecTree {
    let auth = SpecNode::leaf(spec_id(".plugin-workspace/.specs/auth"), "auth", Vec::new())
        .expect("spec node should be valid");
    let root = SpecNode::source_group(spec_id(".plugin-workspace/.specs"), "ルート", vec![auth])
        .expect("source group should be valid");

    SpecTree::new(vec![root])
}

#[test]
fn archive_policy_returns_typed_target_for_scanned_spec() {
    let tree = scanned_tree();
    let requested = spec_id(".plugin-workspace/.specs/auth");

    let target = SpecArchivePolicy
        .target_for(&tree, &requested)
        .expect("scanned spec should be archiveable");

    assert_eq!(&requested, target.spec_id());
}

#[test]
fn archive_policy_rejects_source_group_container_and_unknown_id() {
    let tree = scanned_tree();
    let source_group = spec_id(".plugin-workspace/.specs");
    let container = spec_id(".plugin-workspace");
    let unknown = spec_id(".plugin-workspace/.specs/missing");

    assert_eq!(
        Err(SpecArchivePolicyError::SourceGroup {
            spec_id: source_group.clone(),
        }),
        SpecArchivePolicy.target_for(&tree, &source_group)
    );
    assert_eq!(
        Err(SpecArchivePolicyError::Container {
            spec_id: container.clone(),
        }),
        SpecArchivePolicy.target_for(&tree, &container)
    );
    assert_eq!(
        Err(SpecArchivePolicyError::UnknownSpec {
            spec_id: unknown.clone(),
        }),
        SpecArchivePolicy.target_for(&tree, &unknown)
    );
}
