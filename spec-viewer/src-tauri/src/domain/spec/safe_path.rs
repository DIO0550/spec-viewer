//! Path-safety business rules for spec ids.

use std::path::{Component, Path, PathBuf};

use thiserror::Error;

/// A spec id validated into a traversal-safe relative path.
///
/// Spec ids come from the presentation layer and are joined onto workspace
/// roots, so they must never contain parent references, root components,
/// backslashes, or NUL bytes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SafeSpecPath {
    relative_path: PathBuf,
}

impl SafeSpecPath {
    pub fn parse(spec_id: &str) -> Result<Self, SafeSpecPathError> {
        let trimmed = spec_id.trim();

        if trimmed.is_empty() || trimmed.contains('\\') || trimmed.contains('\0') {
            return Err(SafeSpecPathError::InvalidSpecId {
                spec_id: spec_id.to_string(),
            });
        }

        let mut path = PathBuf::new();
        let mut component_count = 0;

        for component in Path::new(trimmed).components() {
            let Component::Normal(name) = component else {
                return Err(SafeSpecPathError::InvalidSpecId {
                    spec_id: spec_id.to_string(),
                });
            };

            path.push(name);
            component_count += 1;
        }

        if component_count == 0 {
            return Err(SafeSpecPathError::InvalidSpecId {
                spec_id: spec_id.to_string(),
            });
        }

        Ok(Self {
            relative_path: path,
        })
    }

    pub fn as_path(&self) -> &Path {
        &self.relative_path
    }

    pub fn into_path_buf(self) -> PathBuf {
        self.relative_path
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SafeSpecPathError {
    #[error("spec id is invalid: {spec_id}")]
    InvalidSpecId { spec_id: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_allows_nested_spec_ids() {
        let path = SafeSpecPath::parse("auth/code-review").expect("nested spec id should parse");

        assert_eq!(Path::new("auth/code-review"), path.as_path());
    }

    #[test]
    fn parse_rejects_traversal_and_empty_spec_ids() {
        for spec_id in ["", "  ", "../auth", "/auth", "auth\\tasks", "auth\0"] {
            let result = SafeSpecPath::parse(spec_id);

            assert!(
                matches!(result, Err(SafeSpecPathError::InvalidSpecId { .. })),
                "spec id should be rejected: {spec_id:?}"
            );
        }
    }
}
