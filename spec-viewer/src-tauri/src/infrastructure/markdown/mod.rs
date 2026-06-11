//! Markdown file readers.

mod document;
pub mod hash;
pub mod normalizer;
pub mod parser;
mod path_resolution;

pub use document::{MarkdownDocument, MarkdownReadResult, MissingMarkdownFile};
pub use path_resolution::{ResolvedSpecDocumentPath, SpecDocumentPathResolver};

use std::{fs, io, string::FromUtf8Error};

use thiserror::Error;

use crate::domain::{
    spec::{SpecDocumentFormat, SpecFileKey},
    workspace::{WorkspaceConfig, WorkspaceLayout},
};

use self::parser::{parse_markdown_blocks, MarkdownParseError};
use self::path_resolution::display_path;

#[derive(Debug, Clone, Copy, Default)]
pub struct FilesystemMarkdownReader;

impl FilesystemMarkdownReader {
    pub fn new() -> Self {
        Self
    }

    pub fn read(
        &self,
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<MarkdownReadResult, MarkdownReadError> {
        let resolved_path = SpecDocumentPathResolver::resolve(layout, config, spec_id, key)?;
        let file_path = resolved_path.path();

        let contents = match fs::read(file_path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Ok(MarkdownReadResult::Missing(MissingMarkdownFile::new(
                    key,
                    resolved_path.format(),
                    display_path(resolved_path.preferred_path()),
                )));
            }
            Err(source) => {
                return Err(MarkdownReadError::UnreadableFile {
                    path: display_path(file_path),
                    source,
                });
            }
        };

        let contents =
            String::from_utf8(contents).map_err(|source| MarkdownReadError::InvalidUtf8 {
                path: display_path(file_path),
                source,
            })?;

        let blocks = match resolved_path.format() {
            SpecDocumentFormat::Markdown => parse_markdown_blocks(&contents).map_err(|source| {
                MarkdownReadError::ParseMarkdown {
                    path: display_path(file_path),
                    source,
                }
            })?,
            SpecDocumentFormat::Html => Vec::new(),
        };

        Ok(MarkdownReadResult::Found(MarkdownDocument::new(
            key,
            resolved_path.format(),
            display_path(file_path),
            contents,
            blocks,
        )))
    }
}

#[derive(Debug, Error)]
pub enum MarkdownReadError {
    #[error("workspace config does not define a file for key: {key}")]
    MissingFileMapping { key: SpecFileKey },
    #[error("spec id is invalid: {spec_id}")]
    InvalidSpecId { spec_id: String },
    #[error("workspace root is unavailable: {path}")]
    WorkspaceRootUnavailable { path: String, source: io::Error },
    #[error("failed to inspect markdown path: {path}")]
    InspectPath { path: String, source: io::Error },
    #[error("markdown path escapes workspace root: {path}")]
    PathEscapesWorkspace { path: String },
    #[error("failed to read markdown file: {path}")]
    UnreadableFile { path: String, source: io::Error },
    #[error("markdown file is not valid UTF-8: {path}")]
    InvalidUtf8 { path: String, source: FromUtf8Error },
    #[error("failed to parse markdown blocks: {path}")]
    ParseMarkdown {
        path: String,
        source: MarkdownParseError,
    },
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::{
        spec::SpecFileKey,
        workspace::{WorkspaceConfig, WorkspaceKind, WorkspaceRoot},
    };
    const SPECS_DIR: &str = ".plugin-workspace/.specs";

    struct TestWorkspace {
        root: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let root = env::temp_dir().join(format!(
                "spec-reviewer-markdown-read-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&root).expect("test workspace root should be created");

            Self { root }
        }

        fn create_dir(&self, path: &str) {
            fs::create_dir_all(self.root.join(path)).expect("test directory should be created");
        }

        fn write_file(&self, path: &str, contents: &str) {
            self.write_bytes(path, contents.as_bytes());
        }

        fn write_bytes(&self, path: &str, contents: &[u8]) {
            let path = self.root.join(path);
            let parent = path.parent().expect("test file should have parent");
            fs::create_dir_all(parent).expect("test file parent should be created");
            fs::write(path, contents).expect("test file should be written");
        }

        fn layout(&self) -> WorkspaceLayout {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("test workspace root should be valid");

            WorkspaceLayout::new(root, WorkspaceKind::PluginWorkspace)
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn reads_configured_markdown_file_as_utf8() {
        let workspace = TestWorkspace::new("valid");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/tasks.md",
            "# Tasks\n\n- [ ] Review",
        );

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::Tasks,
            )
            .expect("markdown file should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!(SpecFileKey::Tasks, document.key());
                assert_eq!(SpecDocumentFormat::Markdown, document.format());
                assert!(document.path().ends_with("auth/tasks.md"));
                assert_eq!("# Tasks\n\n- [ ] Review", document.contents());
                assert_eq!(2, document.blocks().len());
                assert_eq!(
                    crate::domain::spec::MarkdownBlockType::Heading,
                    document.blocks()[0].block_type()
                );
                assert_eq!(0, document.blocks()[0].index().value());
                assert_eq!("Tasks", document.blocks()[0].text().normalized());
                assert!(document.blocks()[0]
                    .text_hash()
                    .as_str()
                    .starts_with("sha256:"));
                assert_eq!(
                    crate::domain::spec::MarkdownBlockType::ListItem,
                    document.blocks()[1].block_type()
                );
            }
            MarkdownReadResult::Missing(_) => panic!("expected markdown document"),
        }
    }

    #[test]
    fn reads_html_fallback_when_configured_markdown_file_is_absent() {
        let workspace = TestWorkspace::new("html-fallback");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/tasks.html",
            "<h1>Tasks</h1><p>Review</p>",
        );

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::Tasks,
            )
            .expect("html fallback should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!(SpecDocumentFormat::Html, document.format());
                assert!(document.path().ends_with("auth/tasks.html"));
                assert_eq!("<h1>Tasks</h1><p>Review</p>", document.contents());
                assert!(document.blocks().is_empty());
            }
            MarkdownReadResult::Missing(_) => panic!("expected html fallback document"),
        }
    }

    #[test]
    fn prefers_markdown_over_html_fallback_when_both_exist() {
        let workspace = TestWorkspace::new("markdown-preferred");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "# Markdown");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.html", "<h1>HTML</h1>");

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::Tasks,
            )
            .expect("markdown should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!(SpecDocumentFormat::Markdown, document.format());
                assert!(document.path().ends_with("auth/tasks.md"));
                assert_eq!("# Markdown", document.contents());
            }
            MarkdownReadResult::Missing(_) => panic!("expected markdown document"),
        }
    }

    #[test]
    fn reads_tech_reference_html_when_both_html_and_markdown_exist() {
        let workspace = TestWorkspace::new("tech-reference-html-first");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/tech-reference.html",
            "<h1>Tech</h1>",
        );
        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::TechReference,
            )
            .expect("tech reference should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!(SpecDocumentFormat::Html, document.format());
                assert!(document.path().ends_with("auth/tech-reference.html"));
                assert_eq!("<h1>Tech</h1>", document.contents());
                assert!(document.blocks().is_empty());
            }
            MarkdownReadResult::Missing(_) => panic!("expected tech reference html document"),
        }
    }

    #[test]
    fn reads_tech_reference_markdown_when_html_is_absent() {
        let workspace = TestWorkspace::new("tech-reference-markdown-fallback");
        workspace.write_file(".plugin-workspace/.specs/auth/tech-reference.md", "# Tech");

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::TechReference,
            )
            .expect("tech reference markdown fallback should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!(SpecDocumentFormat::Markdown, document.format());
                assert!(document.path().ends_with("auth/tech-reference.md"));
                assert_eq!("# Tech", document.contents());
                assert_eq!(1, document.blocks().len());
            }
            MarkdownReadResult::Missing(_) => panic!("expected tech reference markdown document"),
        }
    }

    #[test]
    fn returns_missing_html_result_for_absent_tech_reference() {
        let workspace = TestWorkspace::new("tech-reference-missing");
        workspace.create_dir(".plugin-workspace/.specs/auth");

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::TechReference,
            )
            .expect("missing tech reference should be a UI-friendly result");

        match result {
            MarkdownReadResult::Found(_) => panic!("expected missing tech reference result"),
            MarkdownReadResult::Missing(missing) => {
                assert_eq!(SpecFileKey::TechReference, missing.key());
                assert_eq!(SpecDocumentFormat::Html, missing.format());
                assert!(missing.path().ends_with("auth/tech-reference.html"));
            }
        }
    }

    #[test]
    fn reads_tech_reference_override_html_before_same_stem_markdown() {
        let workspace = TestWorkspace::new("tech-reference-override");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/guide.html",
            "<h1>Guide HTML</h1>",
        );
        workspace.write_file(".plugin-workspace/.specs/auth/guide.md", "# Guide Markdown");
        let config =
            WorkspaceConfig::new(vec![crate::domain::workspace::WorkspaceFileMapping::new(
                SpecFileKey::TechReference,
                "guide.md",
            )
            .expect("mapping should be valid")])
            .expect("config should be valid");

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &config,
                "auth",
                SpecFileKey::TechReference,
            )
            .expect("tech reference override should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!(SpecDocumentFormat::Html, document.format());
                assert!(document.path().ends_with("auth/guide.html"));
                assert_eq!("<h1>Guide HTML</h1>", document.contents());
            }
            MarkdownReadResult::Missing(_) => panic!("expected tech reference html document"),
        }
    }

    #[test]
    fn reads_configured_html_file_without_markdown_reverse_fallback() {
        let workspace = TestWorkspace::new("configured-html");
        workspace.write_file(
            ".plugin-workspace/.specs/auth/preview.html",
            "<h1>Preview</h1>",
        );
        let config =
            WorkspaceConfig::new(vec![crate::domain::workspace::WorkspaceFileMapping::new(
                SpecFileKey::Tasks,
                "preview.html",
            )
            .expect("mapping should be valid")])
            .expect("config should be valid");

        let result = FilesystemMarkdownReader::new()
            .read(&workspace.layout(), &config, "auth", SpecFileKey::Tasks)
            .expect("configured html should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!(SpecDocumentFormat::Html, document.format());
                assert!(document.path().ends_with("auth/preview.html"));
                assert!(document.blocks().is_empty());
            }
            MarkdownReadResult::Missing(_) => panic!("expected configured html document"),
        }
    }

    #[test]
    fn reads_renamed_markdown_file_through_config_mapping() {
        let workspace = TestWorkspace::new("renamed-config");
        workspace.write_file(".plugin-workspace/.specs/auth/todo.md", "# Renamed Tasks");
        let config =
            WorkspaceConfig::new(vec![crate::domain::workspace::WorkspaceFileMapping::new(
                SpecFileKey::Tasks,
                "todo.md",
            )
            .expect("mapping should be valid")])
            .expect("config should be valid");

        let result = FilesystemMarkdownReader::new()
            .read(&workspace.layout(), &config, "auth", SpecFileKey::Tasks)
            .expect("renamed markdown file should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert!(document.path().ends_with("auth/todo.md"));
                assert_eq!("# Renamed Tasks", document.contents());
                assert_eq!(1, document.blocks().len());
            }
            MarkdownReadResult::Missing(_) => panic!("expected renamed markdown document"),
        }
    }

    #[test]
    fn reads_empty_markdown_file_as_document_without_blocks() {
        let workspace = TestWorkspace::new("empty");
        workspace.write_file(".plugin-workspace/.specs/auth/tasks.md", "");

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::Tasks,
            )
            .expect("empty markdown file should be readable");

        match result {
            MarkdownReadResult::Found(document) => {
                assert_eq!("", document.contents());
                assert!(document.blocks().is_empty());
            }
            MarkdownReadResult::Missing(_) => panic!("expected empty markdown document"),
        }
    }

    #[test]
    fn returns_missing_result_for_absent_configured_file() {
        let workspace = TestWorkspace::new("missing");
        workspace.create_dir(".plugin-workspace/.specs/auth");

        let result = FilesystemMarkdownReader::new()
            .read(
                &workspace.layout(),
                &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
                "auth",
                SpecFileKey::Tasks,
            )
            .expect("missing markdown file should be a UI-friendly result");

        match result {
            MarkdownReadResult::Found(_) => panic!("expected missing markdown result"),
            MarkdownReadResult::Missing(missing) => {
                assert_eq!(SpecFileKey::Tasks, missing.key());
                assert_eq!(SpecDocumentFormat::Markdown, missing.format());
                assert!(missing.path().ends_with("auth/tasks.md"));
            }
        }
    }

    #[test]
    fn rejects_parent_path_traversal_in_spec_id() {
        let workspace = TestWorkspace::new("traversal");
        workspace.write_file("outside/tasks.md", "secret");

        let result = FilesystemMarkdownReader::new().read(
            &workspace.layout(),
            &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
            "../outside",
            SpecFileKey::Tasks,
        );

        assert!(matches!(
            result,
            Err(MarkdownReadError::InvalidSpecId { spec_id }) if spec_id == "../outside"
        ));
    }

    #[test]
    fn rejects_absolute_spec_id() {
        let workspace = TestWorkspace::new("absolute");

        let result = FilesystemMarkdownReader::new().read(
            &workspace.layout(),
            &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
            "/tmp/spec",
            SpecFileKey::Tasks,
        );

        assert!(matches!(
            result,
            Err(MarkdownReadError::InvalidSpecId { spec_id }) if spec_id == "/tmp/spec"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape_outside_workspace() {
        use std::os::unix::fs as unix_fs;

        let workspace = TestWorkspace::new("symlink-escape");
        let outside = TestWorkspace::new("outside");
        workspace.create_dir(SPECS_DIR);
        outside.write_file("escaped/tasks.md", "secret");
        unix_fs::symlink(
            outside.root.join("escaped"),
            workspace.root.join(format!("{SPECS_DIR}/auth")),
        )
        .expect("test symlink should be created");

        let result = FilesystemMarkdownReader::new().read(
            &workspace.layout(),
            &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
            "auth",
            SpecFileKey::Tasks,
        );

        assert!(matches!(
            result,
            Err(MarkdownReadError::PathEscapesWorkspace { path }) if path.ends_with("escaped/tasks.md")
        ));
    }

    #[test]
    fn rejects_invalid_utf8_markdown_contents() {
        let workspace = TestWorkspace::new("invalid-utf8");
        workspace.write_bytes(".plugin-workspace/.specs/auth/tasks.md", &[0xff, 0xfe]);

        let result = FilesystemMarkdownReader::new().read(
            &workspace.layout(),
            &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
            "auth",
            SpecFileKey::Tasks,
        );

        assert!(matches!(result, Err(MarkdownReadError::InvalidUtf8 { .. })));
    }

    #[test]
    fn returns_unreadable_error_for_directory_at_markdown_path() {
        let workspace = TestWorkspace::new("unreadable");
        workspace.create_dir(".plugin-workspace/.specs/auth/tasks.md");

        let result = FilesystemMarkdownReader::new().read(
            &workspace.layout(),
            &WorkspaceConfig::default_for(WorkspaceKind::PluginWorkspace),
            "auth",
            SpecFileKey::Tasks,
        );

        assert!(matches!(
            result,
            Err(MarkdownReadError::UnreadableFile { path, .. }) if path.ends_with("auth/tasks.md")
        ));
    }
}
