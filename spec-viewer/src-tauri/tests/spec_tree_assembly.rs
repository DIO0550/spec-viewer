use spec_reviewer_lib::domain::spec::{SpecFile, SpecFileKey, SpecFileStatus, SpecNode};

#[test]
fn present_document_makes_a_spec_reviewable_and_archiveable() {
    let node = SpecNode::leaf(
        "auth",
        "auth",
        vec![
            SpecFile::new(SpecFileKey::Tasks, "tasks.md", SpecFileStatus::Present)
                .expect("present file fixture should be valid"),
        ],
    )
    .expect("spec fixture should be valid");

    assert!(node.is_reviewable());
    assert!(node.is_archiveable());
}

#[test]
fn empty_and_missing_only_specs_are_not_reviewable_or_archiveable() {
    let empty =
        SpecNode::leaf("empty", "empty", Vec::new()).expect("empty spec fixture should be valid");
    let missing_only = SpecNode::leaf(
        "missing",
        "missing",
        vec![
            SpecFile::new(SpecFileKey::Tasks, "tasks.md", SpecFileStatus::Missing)
                .expect("missing file fixture should be valid"),
        ],
    )
    .expect("missing-only spec fixture should be valid");

    for node in [&empty, &missing_only] {
        assert!(!node.is_reviewable());
        assert!(!node.is_archiveable());
    }
}
