//! Filesystem reader for user review run bundles.

use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::{DateTime, Utc};
use thiserror::Error;

use crate::{
    domain::{
        review_run::{
            ReviewRunResultMarkdown, UserReviewRun, UserReviewRunStatus, UserReviewRunTarget,
        },
        spec::SpecId,
        workspace::WorkspaceLayout,
    },
    infrastructure::{
        filesystem::{spec_directory_path, SafeSpecPathError},
        persistence::{
            review_run_paths::{ReviewRunFolderState, USER_REVIEW_DIRECTORY},
            review_run_schema::{
                ReviewRunManifestDocument, ReviewRunManifestRestoreError, ReviewRunStatusDocument,
            },
        },
    },
};

/// Reads persisted review run bundles from the workspace filesystem.
#[derive(Debug, Clone, Copy, Default)]
pub struct ReviewRunReader;

impl ReviewRunReader {
    pub fn new() -> Self {
        Self
    }

    pub fn read_manifest(
        &self,
        run_directory: &Path,
    ) -> Result<ReviewRunManifestDocument, ReviewRunReadError> {
        let path = run_directory.join("manifest.json");
        let contents = fs::read_to_string(&path).map_err(|source| ReviewRunReadError::Storage {
            message: format!(
                "failed to read review run manifest {}: {source}",
                path.to_string_lossy()
            ),
        })?;

        serde_json::from_str(&contents).map_err(|source| ReviewRunReadError::Storage {
            message: format!(
                "failed to parse review run manifest {}: {source}",
                path.to_string_lossy()
            ),
        })
    }

    pub fn read_status(
        &self,
        run_directory: &Path,
    ) -> Result<ReviewRunStatusDocument, ReviewRunReadError> {
        let path = run_directory.join("status.json");
        let contents = fs::read_to_string(&path).map_err(|source| ReviewRunReadError::Storage {
            message: format!(
                "failed to read review run status {}: {source}",
                path.to_string_lossy()
            ),
        })?;

        serde_json::from_str(&contents).map_err(|source| ReviewRunReadError::Storage {
            message: format!(
                "failed to parse review run status {}: {source}",
                path.to_string_lossy()
            ),
        })
    }

    pub fn read_result_summary(
        &self,
        run_directory: &Path,
    ) -> Result<Option<String>, ReviewRunReadError> {
        let path = run_directory.join("result.md");

        if !path.exists() {
            return Ok(None);
        }

        let contents = fs::read_to_string(&path).map_err(|source| ReviewRunReadError::Storage {
            message: format!(
                "failed to read review run result {}: {source}",
                path.to_string_lossy()
            ),
        })?;

        Ok(ReviewRunResultMarkdown::new(contents).summary())
    }

    /// Collects warnings for source files that changed after the run was exported.
    pub fn collect_source_file_change_warnings(
        &self,
        manifest: &ReviewRunManifestDocument,
    ) -> Result<Vec<String>, ReviewRunReadError> {
        let workspace_path = manifest.execution_target.workspace_path();
        let mut warnings = Vec::new();

        for source_file in &manifest.source_files {
            let source_path = Path::new(workspace_path).join(&source_file.relative_path);

            if source_changed_after_export(&source_path, manifest.created_at)? {
                warnings.push(format!(
                    "source file changed after export: {}",
                    source_file.relative_path
                ));
            }
        }

        Ok(warnings)
    }

    /// Lists review runs persisted for the given target and folder state.
    pub fn list_state(
        &self,
        layout: &WorkspaceLayout,
        target: &UserReviewRunTarget,
        state: ReviewRunFolderState,
    ) -> Result<ReviewRunStateListing, ReviewRunReadError> {
        let directory = state_directory(layout, target.spec_id(), state)?;

        if !directory.exists() {
            return Ok(ReviewRunStateListing::default());
        }

        let entries = fs::read_dir(&directory).map_err(|source| ReviewRunReadError::Storage {
            message: format!(
                "failed to read review run directory {}: {source}",
                directory.to_string_lossy()
            ),
        })?;
        let mut records = Vec::new();
        let mut defects = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|source| ReviewRunReadError::Storage {
                message: format!(
                    "failed to read review run entry {}: {source}",
                    directory.to_string_lossy()
                ),
            })?;
            let path = entry.path();

            if !path.exists() {
                defects.push(ReviewRunListDefect::MissingFolder {
                    folder_path: path.to_string_lossy().into_owned(),
                });
                continue;
            }

            if !path.is_dir() {
                continue;
            }

            let manifest = match self.read_manifest(&path) {
                Ok(manifest) => manifest,
                Err(error) => {
                    defects.push(ReviewRunListDefect::Malformed {
                        folder_path: path.to_string_lossy().into_owned(),
                        error,
                    });
                    continue;
                }
            };

            if !manifest.has_supported_schema_version() || !manifest.target.matches_target(target) {
                continue;
            }

            let metadata = match self.read_listed_metadata(&path) {
                Ok(metadata) => metadata,
                Err(error) => {
                    defects.push(ReviewRunListDefect::Malformed {
                        folder_path: path.to_string_lossy().into_owned(),
                        error,
                    });
                    continue;
                }
            };
            records.push(ReviewRunRecord {
                review_run: manifest.restore_review_run_with_status(metadata.status)?,
                folder_path: path.to_string_lossy().into_owned(),
                summary: metadata.summary,
                warnings: metadata.warnings,
            });
        }

        records.sort_by(|left, right| {
            right
                .review_run
                .created_at()
                .cmp(&left.review_run.created_at())
        });

        Ok(ReviewRunStateListing { records, defects })
    }

    fn read_listed_metadata(
        &self,
        run_directory: &Path,
    ) -> Result<ListedReviewRunMetadata, ReviewRunReadError> {
        let status = self.read_status(run_directory)?;
        let result_summary = self.read_result_summary(run_directory)?;

        Ok(ListedReviewRunMetadata {
            status: status.status.to_domain(),
            summary: status.summary.or(result_summary),
            warnings: status.warnings,
        })
    }
}

fn state_directory(
    layout: &WorkspaceLayout,
    spec_id: &SpecId,
    state: ReviewRunFolderState,
) -> Result<PathBuf, ReviewRunReadError> {
    Ok(spec_directory_path(layout, spec_id.as_str())?
        .join(USER_REVIEW_DIRECTORY)
        .join(state.directory_name()))
}

fn source_changed_after_export(
    source_path: &Path,
    created_at: DateTime<Utc>,
) -> Result<bool, ReviewRunReadError> {
    let metadata = match fs::metadata(source_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(true);
        }
        Err(source) => {
            return Err(ReviewRunReadError::Storage {
                message: format!(
                    "failed to read source file metadata {}: {source}",
                    source_path.to_string_lossy()
                ),
            });
        }
    };
    let modified_at = metadata
        .modified()
        .map_err(|source| ReviewRunReadError::Storage {
            message: format!(
                "failed to read source file modified time {}: {source}",
                source_path.to_string_lossy()
            ),
        })?;
    let modified_at: DateTime<Utc> = modified_at.into();

    Ok(modified_at > created_at)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ListedReviewRunMetadata {
    status: UserReviewRunStatus,
    summary: Option<String>,
    warnings: Vec<String>,
}

/// A review run successfully read from a state directory listing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewRunRecord {
    review_run: UserReviewRun,
    folder_path: String,
    summary: Option<String>,
    warnings: Vec<String>,
}

impl ReviewRunRecord {
    pub fn into_parts(self) -> (UserReviewRun, String, Option<String>, Vec<String>) {
        (
            self.review_run,
            self.folder_path,
            self.summary,
            self.warnings,
        )
    }
}

/// A review run folder that could not be listed as a valid run.
#[derive(Debug)]
pub enum ReviewRunListDefect {
    MissingFolder {
        folder_path: String,
    },
    Malformed {
        folder_path: String,
        error: ReviewRunReadError,
    },
}

/// The result of listing one review run state directory.
#[derive(Debug, Default)]
pub struct ReviewRunStateListing {
    records: Vec<ReviewRunRecord>,
    defects: Vec<ReviewRunListDefect>,
}

impl ReviewRunStateListing {
    pub fn into_parts(self) -> (Vec<ReviewRunRecord>, Vec<ReviewRunListDefect>) {
        (self.records, self.defects)
    }
}

/// Errors raised while reading persisted review run bundles.
#[derive(Debug, Error)]
pub enum ReviewRunReadError {
    #[error("{message}")]
    Storage { message: String },
    #[error(transparent)]
    SpecPath(#[from] SafeSpecPathError),
    #[error(transparent)]
    Restore(#[from] ReviewRunManifestRestoreError),
}
