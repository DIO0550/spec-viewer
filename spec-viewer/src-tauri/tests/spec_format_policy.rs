use std::path::{Path, PathBuf};

use spec_reviewer_lib::{
    domain::spec::{
        SpecDocumentFormat, SpecFileCandidateNameStrategy, SpecFileCandidateRule, SpecFileKey,
    },
    infrastructure::spec_file_resolution::spec_file_path_candidates,
};

fn candidate_rules(
    key: SpecFileKey,
    configured_format: SpecDocumentFormat,
) -> Vec<SpecFileCandidateRule> {
    key.format_policy(configured_format)
        .candidate_rules()
        .to_vec()
}

fn candidate_paths(key: SpecFileKey, configured_path: &str) -> Vec<(PathBuf, SpecDocumentFormat)> {
    spec_file_path_candidates(key, Path::new(configured_path))
        .into_iter()
        .map(|candidate| (candidate.path().to_path_buf(), candidate.format()))
        .collect()
}

#[test]
fn html_first_keys_replace_the_configured_extension_for_both_candidates() {
    let expected = vec![
        SpecFileCandidateRule::new(
            SpecDocumentFormat::Html,
            SpecFileCandidateNameStrategy::ReplaceExtension,
        ),
        SpecFileCandidateRule::new(
            SpecDocumentFormat::Markdown,
            SpecFileCandidateNameStrategy::ReplaceExtension,
        ),
    ];

    for key in [
        SpecFileKey::Requirements,
        SpecFileKey::TechReference,
        SpecFileKey::TestCases,
    ] {
        assert_eq!(expected, candidate_rules(key, SpecDocumentFormat::Markdown));
        assert_eq!(expected, candidate_rules(key, SpecDocumentFormat::Html));
    }
}

#[test]
fn markdown_policy_preserves_the_configured_name_before_the_html_replacement() {
    assert_eq!(
        vec![
            SpecFileCandidateRule::new(
                SpecDocumentFormat::Markdown,
                SpecFileCandidateNameStrategy::PreserveConfigured,
            ),
            SpecFileCandidateRule::new(
                SpecDocumentFormat::Html,
                SpecFileCandidateNameStrategy::ReplaceExtension,
            ),
        ],
        candidate_rules(SpecFileKey::Tasks, SpecDocumentFormat::Markdown)
    );
}

#[test]
fn html_policy_for_other_keys_preserves_only_the_configured_name() {
    assert_eq!(
        vec![SpecFileCandidateRule::new(
            SpecDocumentFormat::Html,
            SpecFileCandidateNameStrategy::PreserveConfigured,
        )],
        candidate_rules(SpecFileKey::Impl, SpecDocumentFormat::Html)
    );
}

#[test]
fn document_formats_expose_their_candidate_extensions() {
    assert_eq!("md", SpecDocumentFormat::Markdown.extension());
    assert_eq!("html", SpecDocumentFormat::Html.extension());
}

#[test]
fn extensionless_markdown_name_remains_the_first_candidate() {
    assert_eq!(
        vec![
            (PathBuf::from("release-notes"), SpecDocumentFormat::Markdown),
            (
                PathBuf::from("release-notes.html"),
                SpecDocumentFormat::Html,
            ),
        ],
        candidate_paths(SpecFileKey::Impl, "release-notes")
    );
}

#[test]
fn unknown_markdown_name_remains_the_first_candidate() {
    assert_eq!(
        vec![
            (
                PathBuf::from("release-notes.custom"),
                SpecDocumentFormat::Markdown,
            ),
            (
                PathBuf::from("release-notes.html"),
                SpecDocumentFormat::Html,
            ),
        ],
        candidate_paths(SpecFileKey::Impl, "release-notes.custom")
    );
}

#[test]
fn html_first_key_replaces_an_unknown_configured_extension() {
    assert_eq!(
        vec![
            (
                PathBuf::from("product-brief.html"),
                SpecDocumentFormat::Html,
            ),
            (
                PathBuf::from("product-brief.md"),
                SpecDocumentFormat::Markdown,
            ),
        ],
        candidate_paths(SpecFileKey::Requirements, "product-brief.custom")
    );
}
