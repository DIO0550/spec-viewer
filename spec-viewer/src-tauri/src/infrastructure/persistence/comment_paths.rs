//! Comment storage path resolution.
//!
//! Comments live beside a selected spec folder and never inside the Markdown
//! files themselves:
//!
//! ```text
//! <spec-folder>/.comments/<logical-file>.json
//! ```

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use thiserror::Error;

use crate::{
    domain::{comment::CommentScope, spec::SpecFileKey, workspace::WorkspaceLayout},
    infrastructure::filesystem::spec_directory_path,
};

const COMMENT_STORAGE_DIRECTORY: &str = ".comments";
const COMMENT_STORAGE_EXTENSION: &str = "json";

#[derive(Debug, Clone, Copy, Default)]
pub struct CommentStoragePathResolver;

impl CommentStoragePathResolver {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        layout: &WorkspaceLayout,
        scope: &CommentScope,
    ) -> Result<CommentStoragePath, CommentStoragePathError> {
        let spec_directory =
            spec_directory_path(layout, scope.spec_id().as_str()).map_err(|_| {
                CommentStoragePathError::InvalidSpecId {
                    spec_id: scope.spec_id().as_str().to_string(),
                }
            })?;
        let comments_directory = spec_directory.join(COMMENT_STORAGE_DIRECTORY);
        let file_path = comments_directory.join(comment_storage_file_name(scope.file_key()));
        let storage_path = CommentStoragePath {
            spec_directory,
            comments_directory,
            file_path,
        };

        storage_path.ensure_inside_spec_directory()?;

        Ok(storage_path)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentStoragePath {
    spec_directory: PathBuf,
    comments_directory: PathBuf,
    file_path: PathBuf,
}

impl CommentStoragePath {
    pub fn spec_directory(&self) -> &Path {
        &self.spec_directory
    }

    pub fn comments_directory(&self) -> &Path {
        &self.comments_directory
    }

    pub fn file_path(&self) -> &Path {
        &self.file_path
    }

    pub fn ensure_comments_directory(&self) -> Result<(), CommentStoragePathError> {
        fs::create_dir_all(&self.comments_directory).map_err(|source| {
            CommentStoragePathError::CreateCommentsDirectory {
                path: display_path(&self.comments_directory),
                source,
            }
        })
    }

    fn ensure_inside_spec_directory(&self) -> Result<(), CommentStoragePathError> {
        if self.comments_directory.parent() != Some(self.spec_directory.as_path())
            || !self.file_path.starts_with(&self.comments_directory)
        {
            return Err(CommentStoragePathError::PathEscapesSpecDirectory {
                path: display_path(&self.file_path),
            });
        }

        Ok(())
    }
}

#[derive(Debug, Error)]
pub enum CommentStoragePathError {
    #[error("comment spec id is invalid: {spec_id}")]
    InvalidSpecId { spec_id: String },
    #[error("comment storage path escapes the selected spec folder: {path}")]
    PathEscapesSpecDirectory { path: String },
    #[error("failed to create comment storage directory: {path}")]
    CreateCommentsDirectory { path: String, source: io::Error },
}

fn comment_storage_file_name(file_key: SpecFileKey) -> String {
    format!("{}.{}", file_key.as_str(), COMMENT_STORAGE_EXTENSION)
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
        comment::CommentScope,
        spec::{SpecFileKey, SpecId},
        workspace::{WorkspaceKind, WorkspaceRoot},
    };

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
                "spec-reviewer-comment-storage-paths-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&root).expect("test workspace root should be created");

            Self { root }
        }

        fn root(&self) -> &Path {
            &self.root
        }

        fn layout(&self, kind: WorkspaceKind) -> WorkspaceLayout {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("test workspace root should be valid");

            WorkspaceLayout::new(root, kind)
        }

        fn create_dir(&self, path: &str) {
            fs::create_dir_all(self.root.join(path)).expect("test directory should be created");
        }

        fn write_file(&self, path: &str, contents: &str) {
            let path = self.root.join(path);
            let parent = path.parent().expect("test file should have parent");
            fs::create_dir_all(parent).expect("test file parent should be created");
            fs::write(path, contents).expect("test file should be written");
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn resolves_plugin_workspace_comment_file_beside_spec_folder() {
        let workspace = TestWorkspace::new("plugin");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let scope = scope("auth-flow", SpecFileKey::Impl);

        let path = CommentStoragePathResolver::new()
            .resolve(&layout, &scope)
            .expect("comment storage path should resolve");

        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/auth-flow/.comments/impl.json"),
            path.file_path()
        );
        assert_eq!(
            workspace.root().join(".plugin-workspace/.specs/auth-flow"),
            path.spec_directory()
        );
    }

    #[test]
    fn keeps_nested_comment_storage_inside_selected_spec_folder() {
        let workspace = TestWorkspace::new("nested");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let scope = scope("auth-flow/oauth", SpecFileKey::Tasks);

        let path = CommentStoragePathResolver::new()
            .resolve(&layout, &scope)
            .expect("comment storage path should resolve");

        assert_eq!(
            workspace
                .root()
                .join(".plugin-workspace/.specs/auth-flow/oauth"),
            path.spec_directory()
        );
        assert_eq!(
            path.spec_directory().join(COMMENT_STORAGE_DIRECTORY),
            path.comments_directory()
        );
        assert!(path.file_path().starts_with(path.comments_directory()));
    }

    #[test]
    fn rejects_traversal_and_absolute_spec_ids() {
        let workspace = TestWorkspace::new("invalid");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        for spec_id in ["../outside", "auth/../../outside", "/tmp/spec"] {
            let scope = scope(spec_id, SpecFileKey::Tasks);
            let result = CommentStoragePathResolver::new().resolve(&layout, &scope);

            assert!(matches!(
                result,
                Err(CommentStoragePathError::InvalidSpecId { spec_id: actual })
                    if actual == spec_id
            ));
        }
    }

    #[test]
    fn rejects_backslash_and_nul_spec_ids() {
        let workspace = TestWorkspace::new("invalid-separators");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);

        for spec_id in ["auth\\flow", "auth\0flow"] {
            let scope = scope(spec_id, SpecFileKey::Tasks);
            let result = CommentStoragePathResolver::new().resolve(&layout, &scope);

            assert!(matches!(
                result,
                Err(CommentStoragePathError::InvalidSpecId { spec_id: actual })
                    if actual == spec_id
            ));
        }
    }

    #[test]
    fn resolved_missing_comment_file_does_not_require_existing_markdown_or_json() {
        let workspace = TestWorkspace::new("missing");
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let scope = scope("auth-flow", SpecFileKey::Tasks);

        let path = CommentStoragePathResolver::new()
            .resolve(&layout, &scope)
            .expect("missing comment file should still resolve");

        assert!(!path.file_path().exists());
    }

    #[test]
    fn creates_comments_directory_for_first_write_without_touching_unknown_files() {
        let workspace = TestWorkspace::new("create-comments");
        workspace.create_dir(".plugin-workspace/.specs/auth-flow");
        workspace.write_file(
            ".plugin-workspace/.specs/auth-flow/.comments/notes.txt",
            "keep me",
        );
        let layout = workspace.layout(WorkspaceKind::PluginWorkspace);
        let scope = scope("auth-flow", SpecFileKey::Tasks);
        let path = CommentStoragePathResolver::new()
            .resolve(&layout, &scope)
            .expect("comment storage path should resolve");

        path.ensure_comments_directory()
            .expect("comments directory should be created or preserved");

        assert!(path.comments_directory().is_dir());
        assert_eq!(
            "keep me",
            fs::read_to_string(path.comments_directory().join("notes.txt"))
                .expect("unknown comment file should remain")
        );
        assert!(!path.file_path().exists());
    }

    fn scope(spec_id: &str, file_key: SpecFileKey) -> CommentScope {
        CommentScope::new(
            SpecId::new(spec_id).expect("spec id should be a domain value"),
            file_key,
        )
    }
}
