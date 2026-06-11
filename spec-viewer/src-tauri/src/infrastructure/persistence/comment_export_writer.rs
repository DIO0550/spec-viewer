//! Comment export file writer for user-selected destinations.

use std::{fs, io, path::Path};

use thiserror::Error;

/// Writes rendered comment exports to the filesystem.
#[derive(Debug, Clone, Copy, Default)]
pub struct CommentExportWriter;

impl CommentExportWriter {
    pub fn new() -> Self {
        Self
    }

    /// Writes the export contents, rejecting empty destination paths.
    pub fn write(
        &self,
        destination_path: &str,
        contents: &str,
    ) -> Result<(), CommentExportWriteError> {
        if destination_path.trim().is_empty() {
            return Err(CommentExportWriteError::MissingDestinationPath);
        }

        fs::write(Path::new(destination_path), contents).map_err(|source| {
            CommentExportWriteError::Io {
                path: destination_path.to_string(),
                source,
            }
        })
    }
}

/// Error raised while writing a comment export file.
#[derive(Debug, Error)]
pub enum CommentExportWriteError {
    #[error("comment export destination path is required")]
    MissingDestinationPath,
    #[error("failed to write comment export {path}: {source}")]
    Io { path: String, source: io::Error },
}
