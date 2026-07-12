//! Filesystem path resolution for single-document user reviews.

use std::path::{Path, PathBuf};

use crate::{
    domain::{spec::SpecId, user_review::UserReviewId, workspace::WorkspaceLayout},
    infrastructure::filesystem::spec_directory_path,
};

pub const USER_REVIEW_DIRECTORY: &str = "user-review";
pub const ACTIVE_USER_REVIEW_DIRECTORY: &str = "active";
pub const ARCHIVE_USER_REVIEW_DIRECTORY: &str = "archive";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserReviewCollection {
    Active,
    Archive,
}

impl UserReviewCollection {
    pub fn directory_name(self) -> &'static str {
        match self {
            Self::Active => ACTIVE_USER_REVIEW_DIRECTORY,
            Self::Archive => ARCHIVE_USER_REVIEW_DIRECTORY,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct UserReviewPathResolver;

impl UserReviewPathResolver {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(&self, layout: &WorkspaceLayout, spec_id: &SpecId) -> UserReviewStoragePaths {
        let spec_directory = spec_directory_path(layout, spec_id);
        let user_review_directory = spec_directory.join(USER_REVIEW_DIRECTORY);
        let active_directory = user_review_directory.join(ACTIVE_USER_REVIEW_DIRECTORY);
        let archive_directory = user_review_directory.join(ARCHIVE_USER_REVIEW_DIRECTORY);

        UserReviewStoragePaths {
            spec_id: spec_id.clone(),
            spec_directory,
            user_review_directory,
            active_directory,
            archive_directory,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserReviewStoragePaths {
    spec_id: SpecId,
    spec_directory: PathBuf,
    user_review_directory: PathBuf,
    active_directory: PathBuf,
    archive_directory: PathBuf,
}

impl UserReviewStoragePaths {
    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn spec_directory(&self) -> &Path {
        &self.spec_directory
    }

    pub fn user_review_directory(&self) -> &Path {
        &self.user_review_directory
    }

    pub fn active_directory(&self) -> &Path {
        &self.active_directory
    }

    pub fn archive_directory(&self) -> &Path {
        &self.archive_directory
    }

    pub fn collection_directory(&self, collection: UserReviewCollection) -> &Path {
        match collection {
            UserReviewCollection::Active => self.active_directory(),
            UserReviewCollection::Archive => self.archive_directory(),
        }
    }

    pub fn record_path(&self, collection: UserReviewCollection, id: &UserReviewId) -> PathBuf {
        self.collection_directory(collection)
            .join(format!("{id}.json"))
    }

    pub fn legacy_record_path(
        &self,
        collection: UserReviewCollection,
        id: &UserReviewId,
    ) -> PathBuf {
        self.collection_directory(collection).join(id.as_str())
    }

    pub fn has_lexical_containment(&self) -> bool {
        self.user_review_directory.parent() == Some(self.spec_directory.as_path())
            && self.active_directory.parent() == Some(self.user_review_directory.as_path())
            && self.archive_directory.parent() == Some(self.user_review_directory.as_path())
    }
}
