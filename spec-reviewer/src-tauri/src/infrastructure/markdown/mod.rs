//! Markdown file readers.

pub mod hash;
pub mod normalizer;
pub mod parser;

use std::{
    fs, io,
    path::{Path, PathBuf},
    string::FromUtf8Error,
};

use thiserror::Error;

use crate::{
    domain::{
        spec::{MarkdownBlock, SpecDocumentFormat, SpecFileKey},
        workspace::{WorkspaceConfig, WorkspaceLayout},
    },
    infrastructure::filesystem::spec_directory_path,
};

use self::parser::{parse_markdown_blocks, MarkdownParseError};

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
        let resolved_path = resolve_spec_document_path(layout, config, spec_id, key)?;
        let file_path = resolved_path.path();

        let contents = match fs::read(&file_path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Ok(MarkdownReadResult::Missing(MissingMarkdownFile {
                    key,
                    format: resolved_path.format(),
                    path: display_path(resolved_path.preferred_path()),
                }));
            }
            Err(source) => {
                return Err(MarkdownReadError::UnreadableFile {
                    path: display_path(&file_path),
                    source,
                });
            }
        };

        let contents =
            String::from_utf8(contents).map_err(|source| MarkdownReadError::InvalidUtf8 {
                path: display_path(&file_path),
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MarkdownReadResult {
    Found(MarkdownDocument),
    Missing(MissingMarkdownFile),
}

impl MarkdownReadResult {
    pub fn is_missing(&self) -> bool {
        matches!(self, Self::Missing(_))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownDocument {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
    contents: String,
    blocks: Vec<MarkdownBlock>,
}

impl MarkdownDocument {
    pub fn new(
        key: SpecFileKey,
        format: SpecDocumentFormat,
        path: impl Into<String>,
        contents: impl Into<String>,
        blocks: Vec<MarkdownBlock>,
    ) -> Self {
        Self {
            key,
            format,
            path: path.into(),
            contents: contents.into(),
            blocks,
        }
    }

    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn contents(&self) -> &str {
        &self.contents
    }

    pub fn blocks(&self) -> &[MarkdownBlock] {
        &self.blocks
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingMarkdownFile {
    key: SpecFileKey,
    format: SpecDocumentFormat,
    path: String,
}

impl MissingMarkdownFile {
    pub fn key(&self) -> SpecFileKey {
        self.key
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
    }

    pub fn path(&self) -> &str {
        &self.path
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSpecDocumentPath {
    preferred_path: PathBuf,
    path: PathBuf,
    format: SpecDocumentFormat,
}

impl ResolvedSpecDocumentPath {
    pub fn preferred_path(&self) -> &Path {
        &self.preferred_path
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn format(&self) -> SpecDocumentFormat {
        self.format
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

pub fn markdown_file_path(
    layout: &WorkspaceLayout,
    config: &WorkspaceConfig,
    spec_id: &str,
    key: SpecFileKey,
) -> Result<PathBuf, MarkdownReadError> {
    resolve_spec_document_path(layout, config, spec_id, key).map(|resolved_path| resolved_path.path)
}

pub fn resolve_spec_document_path(
    layout: &WorkspaceLayout,
    config: &WorkspaceConfig,
    spec_id: &str,
    key: SpecFileKey,
) -> Result<ResolvedSpecDocumentPath, MarkdownReadError> {
    let mapping = config
        .file_for_key(key)
        .ok_or(MarkdownReadError::MissingFileMapping { key })?;
    let spec_directory =
        spec_directory_path(layout, spec_id).map_err(|_| MarkdownReadError::InvalidSpecId {
            spec_id: spec_id.to_string(),
        })?;
    let preferred_path = spec_directory.join(mapping.file_name());

    ensure_within_workspace(layout, &preferred_path)?;

    let preferred_format = SpecDocumentFormat::from_file_name(mapping.file_name());

    if preferred_format == SpecDocumentFormat::Html || file_exists(&preferred_path)? {
        return Ok(ResolvedSpecDocumentPath {
            preferred_path: preferred_path.clone(),
            path: preferred_path,
            format: preferred_format,
        });
    }

    let Some(html_fallback_path) = html_fallback_path(&preferred_path) else {
        return Ok(ResolvedSpecDocumentPath {
            preferred_path: preferred_path.clone(),
            path: preferred_path,
            format: SpecDocumentFormat::Markdown,
        });
    };

    ensure_within_workspace(layout, &html_fallback_path)?;

    if file_exists(&html_fallback_path)? {
        return Ok(ResolvedSpecDocumentPath {
            preferred_path,
            path: html_fallback_path,
            format: SpecDocumentFormat::Html,
        });
    }

    Ok(ResolvedSpecDocumentPath {
        preferred_path: preferred_path.clone(),
        path: preferred_path,
        format: SpecDocumentFormat::Markdown,
    })
}

fn file_exists(path: &Path) -> Result<bool, MarkdownReadError> {
    match fs::metadata(path) {
        Ok(metadata) => Ok(metadata.is_file()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(source) => Err(MarkdownReadError::InspectPath {
            path: display_path(path),
            source,
        }),
    }
}

fn html_fallback_path(preferred_path: &Path) -> Option<PathBuf> {
    if !preferred_path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
    {
        return None;
    }

    Some(preferred_path.with_extension("html"))
}

fn ensure_within_workspace(
    layout: &WorkspaceLayout,
    file_path: &Path,
) -> Result<(), MarkdownReadError> {
    let workspace_root = PathBuf::from(layout.root().as_str());
    let canonical_root = fs::canonicalize(&workspace_root).map_err(|source| {
        MarkdownReadError::WorkspaceRootUnavailable {
            path: display_path(&workspace_root),
            source,
        }
    })?;

    match fs::canonicalize(file_path) {
        Ok(canonical_file) => ensure_path_starts_with_workspace(&canonical_file, &canonical_root),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            ensure_existing_parent_within_workspace(file_path, &canonical_root)
        }
        Err(source) => Err(MarkdownReadError::InspectPath {
            path: display_path(file_path),
            source,
        }),
    }
}

fn ensure_existing_parent_within_workspace(
    file_path: &Path,
    canonical_root: &Path,
) -> Result<(), MarkdownReadError> {
    let Some(parent) = file_path.parent() else {
        return Err(MarkdownReadError::PathEscapesWorkspace {
            path: display_path(file_path),
        });
    };

    match fs::canonicalize(parent) {
        Ok(canonical_parent) => {
            ensure_path_starts_with_workspace(&canonical_parent, canonical_root)
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(MarkdownReadError::InspectPath {
            path: display_path(parent),
            source,
        }),
    }
}

fn ensure_path_starts_with_workspace(
    path: &Path,
    canonical_root: &Path,
) -> Result<(), MarkdownReadError> {
    if path.starts_with(canonical_root) {
        return Ok(());
    }

    Err(MarkdownReadError::PathEscapesWorkspace {
        path: display_path(path),
    })
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;
    use crate::domain::{
        spec::SpecFileKey,
        workspace::{WorkspaceConfig, WorkspaceKind, WorkspaceRoot},
    };
    use crate::infrastructure::filesystem::safe_relative_spec_path;

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

    #[test]
    fn safe_relative_spec_path_allows_nested_spec_ids() {
        let path =
            safe_relative_spec_path("auth/code-review").expect("nested spec id should be allowed");

        assert_eq!(Path::new("auth/code-review"), path);
    }
}
