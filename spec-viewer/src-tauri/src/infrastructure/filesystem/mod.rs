//! Filesystem adapters.

mod conventions;
mod spec_archive;
mod spec_paths;
mod spec_tree_scan;
#[cfg(test)]
pub(crate) mod test_support;
mod workspace_detection;

pub use crate::domain::spec::SafeSpecPathError;
pub use spec_archive::{SpecArchiveError, SpecArchiver};
pub use spec_paths::SpecPathResolver;
pub use spec_tree_scan::{FilesystemSpecTreeScanner, SpecTreeScanError};
pub use workspace_detection::{FilesystemWorkspaceDetector, WorkspaceDetectionError};
