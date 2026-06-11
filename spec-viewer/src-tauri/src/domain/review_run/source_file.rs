//! Source file snapshot reference for a review run.

use crate::domain::{
    review_run::ReviewRunRelativePath,
    spec::{SpecFileKey, SpecId},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewSourceFile {
    spec_id: SpecId,
    file_key: SpecFileKey,
    relative_path: ReviewRunRelativePath,
}

impl UserReviewSourceFile {
    pub fn new(
        spec_id: SpecId,
        file_key: SpecFileKey,
        relative_path: ReviewRunRelativePath,
    ) -> Self {
        Self {
            spec_id,
            file_key,
            relative_path,
        }
    }

    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn relative_path(&self) -> &ReviewRunRelativePath {
        &self.relative_path
    }
}
