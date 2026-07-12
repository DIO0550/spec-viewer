use thiserror::Error;

use super::{SpecId, SpecNodeKind, SpecTree};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpecArchiveTarget {
    spec_id: SpecId,
}

impl SpecArchiveTarget {
    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct SpecArchivePolicy;

impl SpecArchivePolicy {
    pub fn target_for(
        &self,
        tree: &SpecTree,
        spec_id: &SpecId,
    ) -> Result<SpecArchiveTarget, SpecArchivePolicyError> {
        if let Some(node) = tree.find(spec_id) {
            if node.kind() == SpecNodeKind::SourceGroup {
                return Err(SpecArchivePolicyError::SourceGroup {
                    spec_id: spec_id.clone(),
                });
            }

            if !node.is_archiveable() {
                return Err(SpecArchivePolicyError::NotArchiveable {
                    spec_id: spec_id.clone(),
                });
            }

            return Ok(SpecArchiveTarget {
                spec_id: spec_id.clone(),
            });
        }

        if tree
            .nodes()
            .any(|node| is_strict_ancestor(spec_id, node.id()))
        {
            return Err(SpecArchivePolicyError::Container {
                spec_id: spec_id.clone(),
            });
        }

        Err(SpecArchivePolicyError::UnknownSpec {
            spec_id: spec_id.clone(),
        })
    }
}

fn is_strict_ancestor(candidate: &SpecId, descendant: &SpecId) -> bool {
    descendant
        .as_str()
        .strip_prefix(candidate.as_str())
        .is_some_and(|suffix| suffix.starts_with('/'))
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SpecArchivePolicyError {
    #[error("spec id identifies a source group and cannot be archived: {spec_id}")]
    SourceGroup { spec_id: SpecId },
    #[error("spec id identifies a container and cannot be archived: {spec_id}")]
    Container { spec_id: SpecId },
    #[error("spec id is not present in the scanned spec tree: {spec_id}")]
    UnknownSpec { spec_id: SpecId },
    #[error("spec node is not archiveable: {spec_id}")]
    NotArchiveable { spec_id: SpecId },
}
