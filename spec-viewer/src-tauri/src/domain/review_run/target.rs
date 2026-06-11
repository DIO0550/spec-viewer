//! Review run target scope.

use crate::domain::spec::{SpecFileKey, SpecId};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UserReviewRunTarget {
    File {
        spec_id: SpecId,
        file_key: SpecFileKey,
    },
    Spec {
        spec_id: SpecId,
    },
}

impl UserReviewRunTarget {
    pub fn file(spec_id: SpecId, file_key: SpecFileKey) -> Self {
        Self::File { spec_id, file_key }
    }

    pub fn spec(spec_id: SpecId) -> Self {
        Self::Spec { spec_id }
    }

    pub fn spec_id(&self) -> &SpecId {
        match self {
            Self::File { spec_id, .. } | Self::Spec { spec_id } => spec_id,
        }
    }

    /// Renders a short human-readable description of the review scope.
    pub fn describe(&self) -> String {
        match self {
            Self::File { spec_id, file_key } => {
                format!("file / {spec_id} / {file_key}")
            }
            Self::Spec { spec_id } => format!("spec / {spec_id}"),
        }
    }
}
