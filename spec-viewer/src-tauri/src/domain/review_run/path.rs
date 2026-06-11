//! Review run path value objects.

use std::{fmt, path::Path};

use crate::domain::review_run::ReviewRunDomainError;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ReviewRunPathValue {
    value: String,
}

impl ReviewRunPathValue {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if trimmed.is_empty() || trimmed.contains('\0') {
            return Err(ReviewRunDomainError::InvalidPathValue {
                path: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }
}

impl fmt::Display for ReviewRunPathValue {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ReviewRunRelativePath {
    value: String,
}

impl ReviewRunRelativePath {
    pub fn new(value: impl Into<String>) -> Result<Self, ReviewRunDomainError> {
        let value = value.into();
        let trimmed = value.trim();

        if !Self::is_safe_relative_path(trimmed) {
            return Err(ReviewRunDomainError::InvalidRelativePath {
                path: value.to_string(),
            });
        }

        Ok(Self {
            value: trimmed.to_string(),
        })
    }

    /// Builds the path of a source file relative to the workspace root.
    pub fn from_workspace_source(
        workspace_path: &str,
        source_path: &str,
    ) -> Result<Self, ReviewRunDomainError> {
        let relative = Path::new(source_path)
            .strip_prefix(Path::new(workspace_path))
            .map_err(|_| ReviewRunDomainError::SourceFileOutsideWorkspace {
                path: source_path.to_string(),
            })?;

        Self::new(relative.to_string_lossy())
    }

    pub fn as_str(&self) -> &str {
        &self.value
    }

    fn is_safe_relative_path(value: &str) -> bool {
        if value.is_empty()
            || value.contains('\\')
            || value.contains('\0')
            || value.starts_with('/')
            || value
                .split('/')
                .any(|part| part.is_empty() || part == "." || part == "..")
        {
            return false;
        }

        true
    }
}

impl fmt::Display for ReviewRunRelativePath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_source_paths_reject_traversal_and_absolute_paths() {
        for value in [
            "",
            "../requirements.md",
            "/tmp/requirements.md",
            "spec/../tasks.md",
        ] {
            let result = ReviewRunRelativePath::new(value);

            assert!(matches!(
                result,
                Err(ReviewRunDomainError::InvalidRelativePath { .. })
            ));
        }
    }
}
