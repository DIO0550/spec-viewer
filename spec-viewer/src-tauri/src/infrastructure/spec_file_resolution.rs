//! Spec logical-file candidate path resolution.

use std::path::{Path, PathBuf};

use crate::domain::spec::{SpecDocumentFormat, SpecFileKey};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecFilePathCandidate {
    path: PathBuf,
    format: SpecDocumentFormat,
}

impl SpecFilePathCandidate {
    pub fn new(path: PathBuf, format: SpecDocumentFormat) -> Self {
        Self { path, format }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }
}

pub fn spec_file_path_candidates(
    key: SpecFileKey,
    configured_path: &Path,
) -> Vec<SpecFilePathCandidate> {
    if key == SpecFileKey::TechReference {
        return vec![
            SpecFilePathCandidate::new(
                configured_path.with_extension("html"),
                SpecDocumentFormat::Html,
            ),
            SpecFilePathCandidate::new(
                configured_path.with_extension("md"),
                SpecDocumentFormat::Markdown,
            ),
        ];
    }

    let preferred_format = SpecDocumentFormat::from_file_name(&configured_path.to_string_lossy());

    if preferred_format == SpecDocumentFormat::Markdown {
        return vec![
            SpecFilePathCandidate::new(configured_path.to_path_buf(), SpecDocumentFormat::Markdown),
            SpecFilePathCandidate::new(
                configured_path.with_extension("html"),
                SpecDocumentFormat::Html,
            ),
        ];
    }

    vec![SpecFilePathCandidate::new(
        configured_path.to_path_buf(),
        preferred_format,
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate_paths(
        key: SpecFileKey,
        configured_path: &str,
    ) -> Vec<(PathBuf, SpecDocumentFormat)> {
        spec_file_path_candidates(key, Path::new(configured_path))
            .into_iter()
            .map(|candidate| (candidate.path().to_path_buf(), candidate.format()))
            .collect()
    }

    #[test]
    fn tech_reference_prefers_html_then_markdown_for_default_file_name() {
        assert_eq!(
            vec![
                (
                    PathBuf::from("tech-reference.html"),
                    SpecDocumentFormat::Html
                ),
                (
                    PathBuf::from("tech-reference.md"),
                    SpecDocumentFormat::Markdown
                ),
            ],
            candidate_paths(SpecFileKey::TechReference, "tech-reference.html")
        );
    }

    #[test]
    fn tech_reference_uses_override_stem_with_html_first() {
        assert_eq!(
            vec![
                (PathBuf::from("guide.html"), SpecDocumentFormat::Html),
                (PathBuf::from("guide.md"), SpecDocumentFormat::Markdown),
            ],
            candidate_paths(SpecFileKey::TechReference, "guide.md")
        );
    }

    #[test]
    fn markdown_keys_keep_markdown_then_html_fallback_order() {
        assert_eq!(
            vec![
                (PathBuf::from("tasks.md"), SpecDocumentFormat::Markdown),
                (PathBuf::from("tasks.html"), SpecDocumentFormat::Html),
            ],
            candidate_paths(SpecFileKey::Tasks, "tasks.md")
        );
    }

    #[test]
    fn configured_html_keys_do_not_reverse_fallback_to_markdown() {
        assert_eq!(
            vec![(PathBuf::from("preview.html"), SpecDocumentFormat::Html)],
            candidate_paths(SpecFileKey::Tasks, "preview.html")
        );
    }
}
