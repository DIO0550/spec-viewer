//! Repository contract for persisted comments.

use thiserror::Error;

use crate::domain::spec::{SpecDomainError, SpecFileKey, SpecId};

use super::{Comment, CommentId, CommentStatus};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommentScope {
    spec_id: SpecId,
    file_key: SpecFileKey,
}

impl CommentScope {
    pub fn new(spec_id: SpecId, file_key: SpecFileKey) -> Self {
        Self { spec_id, file_key }
    }

    /// Builds a scope from a raw spec id string, validating the id.
    pub fn parse(spec_id: &str, file_key: SpecFileKey) -> Result<Self, SpecDomainError> {
        Ok(Self::new(SpecId::new(spec_id)?, file_key))
    }

    pub fn spec_id(&self) -> &SpecId {
        &self.spec_id
    }

    pub fn file_key(&self) -> SpecFileKey {
        self.file_key
    }

    pub fn contains_comment(&self, comment: &Comment) -> bool {
        self.file_key == comment.anchor().file_key()
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum CommentStatusFilter {
    #[default]
    All,
    Open,
    Resolved,
}

impl CommentStatusFilter {
    pub fn matches(self, status: CommentStatus) -> bool {
        match self {
            Self::All => true,
            Self::Open => matches!(status, CommentStatus::Open),
            Self::Resolved => matches!(status, CommentStatus::Resolved),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommentListQuery {
    scope: CommentScope,
    status_filter: CommentStatusFilter,
}

impl CommentListQuery {
    pub fn new(scope: CommentScope) -> Self {
        Self {
            scope,
            status_filter: CommentStatusFilter::All,
        }
    }

    pub fn with_status_filter(scope: CommentScope, status_filter: CommentStatusFilter) -> Self {
        Self {
            scope,
            status_filter,
        }
    }

    pub fn open(scope: CommentScope) -> Self {
        Self::with_status_filter(scope, CommentStatusFilter::Open)
    }

    pub fn resolved(scope: CommentScope) -> Self {
        Self::with_status_filter(scope, CommentStatusFilter::Resolved)
    }

    pub fn scope(&self) -> &CommentScope {
        &self.scope
    }

    pub fn status_filter(&self) -> CommentStatusFilter {
        self.status_filter
    }

    pub fn includes(&self, comment: &Comment) -> bool {
        self.scope.contains_comment(comment) && self.status_filter.matches(comment.status())
    }
}

pub trait CommentRepository {
    fn list(&self, query: &CommentListQuery) -> Result<Vec<Comment>, CommentRepositoryError>;

    fn add(
        &self,
        scope: &CommentScope,
        comment: Comment,
    ) -> Result<Comment, CommentRepositoryError>;

    fn update(
        &self,
        scope: &CommentScope,
        comment: Comment,
    ) -> Result<Comment, CommentRepositoryError>;

    fn delete(&self, scope: &CommentScope, id: &CommentId) -> Result<(), CommentRepositoryError>;
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CommentRepositoryError {
    #[error("comment already exists: {id}")]
    DuplicateComment { id: CommentId },
    #[error("comment not found: {id}")]
    CommentNotFound { id: CommentId },
    #[error(
        "comment belongs to file {actual_file_key} but repository scope is {expected_file_key}"
    )]
    ScopeMismatch {
        expected_file_key: SpecFileKey,
        actual_file_key: SpecFileKey,
    },
    #[error("comment repository data is invalid: {message}")]
    InvalidData { message: String },
    #[error("comment repository is unavailable: {message}")]
    Unavailable { message: String },
}

impl CommentRepositoryError {
    pub fn duplicate(id: CommentId) -> Self {
        Self::DuplicateComment { id }
    }

    pub fn not_found(id: CommentId) -> Self {
        Self::CommentNotFound { id }
    }

    pub fn scope_mismatch(expected_file_key: SpecFileKey, actual_file_key: SpecFileKey) -> Self {
        Self::ScopeMismatch {
            expected_file_key,
            actual_file_key,
        }
    }

    pub fn invalid_data(message: impl Into<String>) -> Self {
        Self::InvalidData {
            message: message.into(),
        }
    }

    pub fn unavailable(message: impl Into<String>) -> Self {
        Self::Unavailable {
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, Utc};

    use super::*;
    use crate::domain::{
        comment::{
            BlockIndex, BlockType, CharRange, CommentAnchor, CommentBody, TextHash, TextSnippet,
        },
        spec::SpecDomainError,
    };

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-05T00:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn scope(file_key: SpecFileKey) -> CommentScope {
        CommentScope::new(
            SpecId::new("auth-flow").expect("spec id should be valid"),
            file_key,
        )
    }

    fn comment_with_status(id: &str, file_key: SpecFileKey, status: CommentStatus) -> Comment {
        Comment::restore(
            CommentId::new(id).expect("id should be valid"),
            CommentAnchor::new(
                file_key,
                BlockType::Paragraph,
                BlockIndex::new(1),
                TextHash::new("hash").expect("hash should be valid"),
                TextSnippet::new("selected text").expect("snippet should be valid"),
                CharRange::new(0, 8).expect("range should be valid"),
            ),
            CommentBody::new("Please clarify").expect("body should be valid"),
            status,
            timestamp(1),
            timestamp(1),
        )
        .expect("comment should be valid")
    }

    #[test]
    fn comment_scope_keeps_spec_id_and_logical_file_key() {
        let scope = scope(SpecFileKey::Impl);

        assert_eq!("auth-flow", scope.spec_id().as_str());
        assert_eq!(SpecFileKey::Impl, scope.file_key());
    }

    #[test]
    fn comment_scope_uses_domain_spec_id_validation() {
        let result = SpecId::new("   ");

        assert_eq!(Err(SpecDomainError::MissingSpecId), result);
    }

    #[test]
    fn comment_list_query_defaults_to_all_statuses_for_scope() {
        let query = CommentListQuery::new(scope(SpecFileKey::Tasks));
        let open_comment = comment_with_status("open", SpecFileKey::Tasks, CommentStatus::Open);
        let resolved_comment =
            comment_with_status("resolved", SpecFileKey::Tasks, CommentStatus::Resolved);
        let other_file_comment =
            comment_with_status("other", SpecFileKey::Impl, CommentStatus::Open);

        assert_eq!(CommentStatusFilter::All, query.status_filter());
        assert!(query.includes(&open_comment));
        assert!(query.includes(&resolved_comment));
        assert!(!query.includes(&other_file_comment));
    }

    #[test]
    fn comment_list_query_can_filter_open_or_resolved_comments() {
        let open_query = CommentListQuery::open(scope(SpecFileKey::Impl));
        let resolved_query = CommentListQuery::resolved(scope(SpecFileKey::Impl));
        let open_comment = comment_with_status("open", SpecFileKey::Impl, CommentStatus::Open);
        let resolved_comment =
            comment_with_status("resolved", SpecFileKey::Impl, CommentStatus::Resolved);

        assert!(open_query.includes(&open_comment));
        assert!(!open_query.includes(&resolved_comment));
        assert!(!resolved_query.includes(&open_comment));
        assert!(resolved_query.includes(&resolved_comment));
    }

    #[test]
    fn repository_error_keeps_domain_identifiers_without_storage_details() {
        let id = CommentId::new("comment-1").expect("id should be valid");

        assert_eq!(
            CommentRepositoryError::CommentNotFound { id: id.clone() },
            CommentRepositoryError::not_found(id)
        );
        assert_eq!(
            CommentRepositoryError::ScopeMismatch {
                expected_file_key: SpecFileKey::Tasks,
                actual_file_key: SpecFileKey::Impl,
            },
            CommentRepositoryError::scope_mismatch(SpecFileKey::Tasks, SpecFileKey::Impl)
        );
    }
}
