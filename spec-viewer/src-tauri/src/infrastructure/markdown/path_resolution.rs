//! Resolution of spec document paths with format fallbacks and workspace containment.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use crate::{
    domain::{
        spec::{SpecDocumentFormat, SpecFileKey},
        workspace::{WorkspaceConfig, WorkspaceLayout},
    },
    infrastructure::{
        filesystem::SpecPathResolver,
        spec_file_resolution::{spec_file_path_candidates, SpecFilePathCandidate},
    },
};

use super::MarkdownReadError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSpecDocumentPath {
    preferred_path: PathBuf,
    path: PathBuf,
    format: SpecDocumentFormat,
    candidate_paths: Vec<PathBuf>,
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

    pub fn candidate_paths(&self) -> &[PathBuf] {
        &self.candidate_paths
    }
}

/// Resolves the on-disk document path for a spec file key, guarding against
/// paths that escape the workspace.
#[derive(Debug, Clone, Copy, Default)]
pub struct SpecDocumentPathResolver;

impl SpecDocumentPathResolver {
    pub fn resolve(
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<ResolvedSpecDocumentPath, MarkdownReadError> {
        let mapping = config
            .file_for_key(key)
            .ok_or(MarkdownReadError::MissingFileMapping { key })?;
        let spec_directory =
            SpecPathResolver::spec_directory_path(layout, spec_id).map_err(|_| {
                MarkdownReadError::InvalidSpecId {
                    spec_id: spec_id.to_string(),
                }
            })?;
        let configured_path = spec_directory.join(mapping.file_name());
        let candidates = spec_file_path_candidates(key, &configured_path);
        let preferred = candidates
            .first()
            .ok_or(MarkdownReadError::MissingFileMapping { key })?;

        for candidate in &candidates {
            Self::ensure_within_workspace(layout, candidate.path())?;
        }

        for candidate in &candidates {
            if Self::file_exists(candidate.path())? {
                return Ok(Self::resolved_spec_document_path(
                    candidate,
                    preferred,
                    &candidates,
                ));
            }
        }

        Ok(Self::resolved_spec_document_path(
            preferred,
            preferred,
            &candidates,
        ))
    }

    pub fn markdown_file_path(
        layout: &WorkspaceLayout,
        config: &WorkspaceConfig,
        spec_id: &str,
        key: SpecFileKey,
    ) -> Result<PathBuf, MarkdownReadError> {
        Self::resolve(layout, config, spec_id, key).map(|resolved_path| resolved_path.path)
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

    fn resolved_spec_document_path(
        selected: &SpecFilePathCandidate,
        preferred: &SpecFilePathCandidate,
        candidates: &[SpecFilePathCandidate],
    ) -> ResolvedSpecDocumentPath {
        ResolvedSpecDocumentPath {
            preferred_path: preferred.path().to_path_buf(),
            path: selected.path().to_path_buf(),
            format: selected.format(),
            candidate_paths: candidates
                .iter()
                .map(|candidate| candidate.path().to_path_buf())
                .collect(),
        }
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
            Ok(canonical_file) => {
                Self::ensure_path_starts_with_workspace(&canonical_file, &canonical_root)
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                Self::ensure_existing_parent_within_workspace(file_path, &canonical_root)
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
                Self::ensure_path_starts_with_workspace(&canonical_parent, canonical_root)
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
}

pub(crate) fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
