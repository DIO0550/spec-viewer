//! Filesystem writer for user review run bundles.

use std::{fs, io, path::Path};

use chrono::{DateTime, Utc};
use serde::Serialize;
use thiserror::Error;

use crate::{
    domain::review_run::{
        ReviewRunBundleFile, ReviewRunRelativePath, UserReviewRun, UserReviewRunId,
    },
    infrastructure::persistence::{
        review_run_paths::ReviewRunPath,
        review_run_schema::{
            ReviewRunManifestDocument, ReviewRunStatusDocument, ReviewRunStatusValue,
        },
    },
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunContextSnapshot {
    relative_path: ReviewRunRelativePath,
    contents: String,
}

impl ReviewRunContextSnapshot {
    pub fn new(relative_path: ReviewRunRelativePath, contents: impl Into<String>) -> Self {
        Self {
            relative_path,
            contents: contents.into(),
        }
    }

    pub fn relative_path(&self) -> &ReviewRunRelativePath {
        &self.relative_path
    }

    pub fn contents(&self) -> &str {
        &self.contents
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunBundleDocument {
    pub manifest: ReviewRunManifestDocument,
    pub instructions_markdown: String,
    pub comments_json: serde_json::Value,
    pub result_markdown: String,
    pub status: ReviewRunStatusDocument,
    pub context_snapshots: Vec<ReviewRunContextSnapshot>,
}

impl ReviewRunBundleDocument {
    /// Assembles the persisted bundle documents for a freshly created review run.
    pub fn for_new_run(
        run: &UserReviewRun,
        files: &[ReviewRunBundleFile],
        created_at: DateTime<Utc>,
    ) -> Self {
        Self {
            manifest: ReviewRunManifestDocument::for_new_run(run),
            instructions_markdown: run.render_instructions(files),
            comments_json: serde_json::to_value(ReviewRunCommentsDocument {
                schema_version: "spec-reviewer.review-run.comments.v1",
                review_run_id: run.id().as_str(),
                generated_at: created_at,
                comment_count: run.comment_ids().len(),
                files,
            })
            .expect("review run comments document should serialize"),
            result_markdown: run.render_result_template(),
            status: ReviewRunStatusDocument {
                status: ReviewRunStatusValue::Active,
                updated_at: created_at,
                summary: None,
                warnings: Vec::new(),
            },
            context_snapshots: files
                .iter()
                .map(|file| {
                    ReviewRunContextSnapshot::new(
                        file.context_relative_path().clone(),
                        file.markdown_contents(),
                    )
                })
                .collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewRunCommentsDocument<'a> {
    schema_version: &'static str,
    review_run_id: &'a str,
    generated_at: DateTime<Utc>,
    comment_count: usize,
    files: &'a [ReviewRunBundleFile],
}

#[derive(Debug, Clone, Copy, Default)]
pub struct ReviewRunBundleWriter;

impl ReviewRunBundleWriter {
    pub fn new() -> Self {
        Self
    }

    pub fn write_active_bundle(
        &self,
        path: &ReviewRunPath,
        run_id: &UserReviewRunId,
        bundle: &ReviewRunBundleDocument,
    ) -> Result<(), ReviewRunBundleWriteError> {
        if path.run_directory().exists() {
            return Err(ReviewRunBundleWriteError::ActiveRunExists {
                path: display_path(path.run_directory()),
            });
        }

        fs::create_dir_all(path.active_directory()).map_err(|source| {
            ReviewRunBundleWriteError::CreateDirectory {
                path: display_path(path.active_directory()),
                source,
            }
        })?;
        fs::create_dir_all(path.archive_directory()).map_err(|source| {
            ReviewRunBundleWriteError::CreateDirectory {
                path: display_path(path.archive_directory()),
                source,
            }
        })?;

        let temporary_directory = path
            .active_directory()
            .join(format!(".{}.tmp", run_id.as_str()));

        let write_result = write_bundle_to_temporary_directory(&temporary_directory, bundle)
            .and_then(|_| {
                fs::rename(&temporary_directory, path.run_directory()).map_err(|source| {
                    ReviewRunBundleWriteError::MoveIntoPlace {
                        from: display_path(&temporary_directory),
                        to: display_path(path.run_directory()),
                        source,
                    }
                })
            });

        if let Err(error) = write_result {
            let _ = fs::remove_dir_all(&temporary_directory);
            return Err(error);
        }

        Ok(())
    }

    /// Persists the archived manifest/status documents and moves the run folder
    /// from the active directory into the archive directory.
    pub fn archive_run(
        &self,
        active_run_directory: &Path,
        archive_path: &ReviewRunPath,
        manifest: &ReviewRunManifestDocument,
        status: &ReviewRunStatusDocument,
    ) -> Result<(), ReviewRunArchiveError> {
        write_archived_json_document(&active_run_directory.join("manifest.json"), manifest)?;
        write_archived_json_document(&active_run_directory.join("status.json"), status)?;
        fs::create_dir_all(archive_path.archive_directory()).map_err(|source| {
            ReviewRunArchiveError {
                message: format!(
                    "failed to create archive review run directory {}: {source}",
                    archive_path.archive_directory().to_string_lossy()
                ),
            }
        })?;
        fs::rename(active_run_directory, archive_path.run_directory()).map_err(|source| {
            ReviewRunArchiveError {
                message: format!(
                    "failed to move review run from {} to {}: {source}",
                    active_run_directory.to_string_lossy(),
                    archive_path.run_directory().to_string_lossy()
                ),
            }
        })?;

        Ok(())
    }
}

fn write_archived_json_document<T: Serialize>(
    path: &Path,
    document: &T,
) -> Result<(), ReviewRunArchiveError> {
    let contents =
        serde_json::to_string_pretty(document).map_err(|source| ReviewRunArchiveError {
            message: format!(
                "failed to serialize review run JSON {}: {source}",
                path.to_string_lossy()
            ),
        })?;

    fs::write(path, format!("{contents}\n")).map_err(|source| ReviewRunArchiveError {
        message: format!(
            "failed to write review run JSON {}: {source}",
            path.to_string_lossy()
        ),
    })
}

/// Errors raised while archiving a review run bundle.
#[derive(Debug, Error)]
#[error("{message}")]
pub struct ReviewRunArchiveError {
    message: String,
}

fn write_bundle_to_temporary_directory(
    temporary_directory: &Path,
    bundle: &ReviewRunBundleDocument,
) -> Result<(), ReviewRunBundleWriteError> {
    if temporary_directory.exists() {
        fs::remove_dir_all(temporary_directory).map_err(|source| {
            ReviewRunBundleWriteError::Cleanup {
                path: display_path(temporary_directory),
                source,
            }
        })?;
    }

    fs::create_dir_all(temporary_directory).map_err(|source| {
        ReviewRunBundleWriteError::CreateDirectory {
            path: display_path(temporary_directory),
            source,
        }
    })?;

    write_json_file(&temporary_directory.join("manifest.json"), &bundle.manifest)?;
    write_file(
        &temporary_directory.join("instructions.md"),
        &bundle.instructions_markdown,
    )?;
    write_json_file(
        &temporary_directory.join("comments.json"),
        &bundle.comments_json,
    )?;
    write_file(
        &temporary_directory.join("result.md"),
        &bundle.result_markdown,
    )?;
    write_json_file(&temporary_directory.join("status.json"), &bundle.status)?;

    for snapshot in &bundle.context_snapshots {
        write_file(
            &temporary_directory.join(snapshot.relative_path().as_str()),
            snapshot.contents(),
        )?;
    }

    Ok(())
}

fn write_json_file<T: serde::Serialize>(
    path: &Path,
    document: &T,
) -> Result<(), ReviewRunBundleWriteError> {
    let contents = serde_json::to_string_pretty(document).map_err(|source| {
        ReviewRunBundleWriteError::SerializeJson {
            path: display_path(path),
            source,
        }
    })?;

    write_file(path, &format!("{contents}\n"))
}

fn write_file(path: &Path, contents: &str) -> Result<(), ReviewRunBundleWriteError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| {
            ReviewRunBundleWriteError::CreateDirectory {
                path: display_path(parent),
                source,
            }
        })?;
    }

    fs::write(path, contents).map_err(|source| ReviewRunBundleWriteError::WriteFile {
        path: display_path(path),
        source,
    })
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[derive(Debug, Error)]
pub enum ReviewRunBundleWriteError {
    #[error("active review run already exists at: {path}")]
    ActiveRunExists { path: String },
    #[error("failed to create review run directory: {path}")]
    CreateDirectory { path: String, source: io::Error },
    #[error("failed to serialize review run JSON: {path}")]
    SerializeJson {
        path: String,
        source: serde_json::Error,
    },
    #[error("failed to write review run file: {path}")]
    WriteFile { path: String, source: io::Error },
    #[error("failed to move review run into place from {from} to {to}")]
    MoveIntoPlace {
        from: String,
        to: String,
        source: io::Error,
    },
    #[error("failed to clean temporary review run directory: {path}")]
    Cleanup { path: String, source: io::Error },
}

#[cfg(test)]
mod tests {
    use std::{
        env,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use chrono::{TimeZone, Utc};
    use serde_json::json;

    use super::*;
    use crate::{
        domain::{
            review_run::UserReviewRunId,
            spec::SpecId,
            workspace::{WorkspaceKind, WorkspaceLayout, WorkspaceRoot},
        },
        infrastructure::persistence::{
            review_run_paths::{ReviewRunFolderState, ReviewRunPathResolver},
            review_run_schema::{
                ReviewRunExecutionTargetDocument, ReviewRunManifestDocument,
                ReviewRunStatusDocument, ReviewRunStatusValue, ReviewRunTargetDocument,
            },
        },
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
                "spec-reviewer-review-run-writer-{name}-{}-{timestamp}",
                std::process::id()
            ));
            fs::create_dir_all(&root).expect("test workspace root should be created");

            Self { root }
        }

        fn layout(&self) -> WorkspaceLayout {
            let root = WorkspaceRoot::new(self.root.to_string_lossy())
                .expect("test workspace root should be valid");

            WorkspaceLayout::new(root, WorkspaceKind::PluginWorkspace)
        }

        fn path(&self) -> ReviewRunPath {
            ReviewRunPathResolver::new()
                .resolve(
                    &self.layout(),
                    &SpecId::new("auth").expect("spec id should be valid"),
                    &run_id(),
                    ReviewRunFolderState::Active,
                )
                .expect("review run path should resolve")
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn run_id() -> UserReviewRunId {
        UserReviewRunId::new("2026-05-06T120000Z-file-tasks").expect("run id should be valid")
    }

    fn bundle() -> ReviewRunBundleDocument {
        let now = Utc
            .with_ymd_and_hms(2026, 5, 6, 12, 0, 0)
            .single()
            .expect("timestamp should be valid");

        ReviewRunBundleDocument {
            manifest: ReviewRunManifestDocument {
                schema_version: ReviewRunManifestDocument::schema_version().to_string(),
                id: run_id().as_str().to_string(),
                status: ReviewRunStatusValue::Active,
                workspace_path: "/workspace/project".to_string(),
                target: ReviewRunTargetDocument::File {
                    spec_id: "auth".to_string(),
                    file_key: "tasks".to_string(),
                },
                spec_folder_path: "/workspace/project/.plugin-workspace/.specs/auth".to_string(),
                execution_target: ReviewRunExecutionTargetDocument::CurrentWorkspace {
                    workspace_path: "/workspace/project".to_string(),
                },
                source_files: Vec::new(),
                comment_ids: vec!["cmt_1".to_string()],
                created_at: now,
                archived_at: None,
            },
            instructions_markdown: "# 指示\n".to_string(),
            comments_json: json!({ "comments": [] }),
            result_markdown: "# 結果\n".to_string(),
            status: ReviewRunStatusDocument {
                status: ReviewRunStatusValue::Active,
                updated_at: now,
                summary: None,
                warnings: Vec::new(),
            },
            context_snapshots: vec![ReviewRunContextSnapshot::new(
                ReviewRunRelativePath::new("context/auth/tasks.md")
                    .expect("relative path should be valid"),
                "# Tasks\n",
            )],
        }
    }

    #[test]
    fn writes_bundle_files_into_active_review_run_directory() {
        let workspace = TestWorkspace::new("write");
        let path = workspace.path();

        ReviewRunBundleWriter::new()
            .write_active_bundle(&path, &run_id(), &bundle())
            .expect("bundle should be written");

        assert!(path.run_directory().join("manifest.json").is_file());
        assert!(path.run_directory().join("instructions.md").is_file());
        assert!(path.run_directory().join("comments.json").is_file());
        assert!(path.run_directory().join("context/auth/tasks.md").is_file());
        assert!(path.run_directory().join("result.md").is_file());
        assert!(path.run_directory().join("status.json").is_file());
        assert!(!path
            .active_directory()
            .join(format!(".{}.tmp", run_id().as_str()))
            .exists());
    }

    #[test]
    fn refuses_to_overwrite_existing_active_review_run() {
        let workspace = TestWorkspace::new("exists");
        let path = workspace.path();

        fs::create_dir_all(path.run_directory()).expect("existing run should be created");
        let result = ReviewRunBundleWriter::new().write_active_bundle(&path, &run_id(), &bundle());

        assert!(matches!(
            result,
            Err(ReviewRunBundleWriteError::ActiveRunExists { .. })
        ));
    }
}
