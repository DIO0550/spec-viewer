//! Comment entity.

use chrono::{DateTime, Utc};

use crate::domain::comment::{
    CommentAnchor, CommentBody, CommentDomainError, CommentId, CommentStatus,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Comment {
    id: CommentId,
    anchor: CommentAnchor,
    body: CommentBody,
    status: CommentStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Comment {
    pub fn new(
        id: CommentId,
        anchor: CommentAnchor,
        body: CommentBody,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Result<Self, CommentDomainError> {
        if updated_at < created_at {
            return Err(CommentDomainError::UpdatedBeforeCreated);
        }

        Ok(Self {
            id,
            anchor,
            body,
            status: CommentStatus::Open,
            created_at,
            updated_at,
        })
    }

    pub fn restore(
        id: CommentId,
        anchor: CommentAnchor,
        body: CommentBody,
        status: CommentStatus,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Result<Self, CommentDomainError> {
        if updated_at < created_at {
            return Err(CommentDomainError::UpdatedBeforeCreated);
        }

        Ok(Self {
            id,
            anchor,
            body,
            status,
            created_at,
            updated_at,
        })
    }

    pub fn id(&self) -> &CommentId {
        &self.id
    }

    pub fn anchor(&self) -> &CommentAnchor {
        &self.anchor
    }

    pub fn body(&self) -> &CommentBody {
        &self.body
    }

    pub fn status(&self) -> CommentStatus {
        self.status
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    pub fn is_resolved(&self) -> bool {
        self.status.is_resolved()
    }

    pub fn update_body(
        &mut self,
        body: CommentBody,
        updated_at: DateTime<Utc>,
    ) -> Result<(), CommentDomainError> {
        self.ensure_update_time(updated_at)?;
        self.body = body;
        self.updated_at = updated_at;
        Ok(())
    }

    pub fn resolve(&mut self, updated_at: DateTime<Utc>) -> Result<(), CommentDomainError> {
        self.ensure_update_time(updated_at)?;
        self.status = CommentStatus::Resolved;
        self.updated_at = updated_at;
        Ok(())
    }

    pub fn reopen(&mut self, updated_at: DateTime<Utc>) -> Result<(), CommentDomainError> {
        self.ensure_update_time(updated_at)?;
        self.status = CommentStatus::Open;
        self.updated_at = updated_at;
        Ok(())
    }

    fn ensure_update_time(&self, updated_at: DateTime<Utc>) -> Result<(), CommentDomainError> {
        if updated_at < self.created_at {
            return Err(CommentDomainError::UpdatedBeforeCreated);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{
        comment::{BlockIndex, BlockType, CharRange, TextHash, TextSnippet},
        spec::SpecFileKey,
    };

    fn timestamp(second: u32) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&format!("2026-05-05T00:00:{second:02}Z"))
            .expect("timestamp should parse")
            .with_timezone(&Utc)
    }

    fn anchor_for_file(file_key: SpecFileKey) -> CommentAnchor {
        CommentAnchor::new(
            file_key,
            BlockType::Paragraph,
            BlockIndex::new(2),
            TextHash::new("block-hash").expect("hash should be valid"),
            TextSnippet::new("Selected text").expect("snippet should be valid"),
            CharRange::new(4, 17).expect("range should be valid"),
        )
    }

    fn comment_with_id(id: &str) -> Comment {
        Comment::new(
            CommentId::new(id).expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Looks good").expect("body should be valid"),
            timestamp(1),
            timestamp(1),
        )
        .expect("comment should be valid")
    }

    #[test]
    fn comment_starts_open_with_anchor_body_and_timestamps() {
        let created_at = timestamp(1);
        let updated_at = timestamp(2);
        let comment = Comment::new(
            CommentId::new("comment-1").expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Looks good").expect("body should be valid"),
            created_at,
            updated_at,
        )
        .expect("comment should be valid");

        assert_eq!("comment-1", comment.id().as_str());
        assert_eq!(SpecFileKey::Impl, comment.anchor().file_key());
        assert_eq!("Looks good", comment.body().as_str());
        assert_eq!(CommentStatus::Open, comment.status());
        assert!(!comment.is_resolved());
        assert_eq!(created_at, comment.created_at());
        assert_eq!(updated_at, comment.updated_at());
    }

    #[test]
    fn comment_restores_existing_status() {
        let comment = Comment::restore(
            CommentId::new("comment-1").expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Done").expect("body should be valid"),
            CommentStatus::Resolved,
            timestamp(1),
            timestamp(2),
        )
        .expect("comment should be valid");

        assert_eq!(CommentStatus::Resolved, comment.status());
        assert!(comment.is_resolved());
    }

    #[test]
    fn comment_rejects_updated_timestamp_before_created_timestamp() {
        let result = Comment::new(
            CommentId::new("comment-1").expect("id should be valid"),
            anchor_for_file(SpecFileKey::Impl),
            CommentBody::new("Looks good").expect("body should be valid"),
            timestamp(2),
            timestamp(1),
        );

        assert_eq!(Err(CommentDomainError::UpdatedBeforeCreated), result);
    }

    #[test]
    fn comment_can_update_body_and_resolution_status() {
        let mut comment = comment_with_id("comment-1");

        comment
            .update_body(
                CommentBody::new("Please expand this section.").expect("body should be valid"),
                timestamp(2),
            )
            .expect("update should be valid");
        comment
            .resolve(timestamp(3))
            .expect("resolve should be valid");
        comment
            .reopen(timestamp(4))
            .expect("reopen should be valid");

        assert_eq!("Please expand this section.", comment.body().as_str());
        assert_eq!(CommentStatus::Open, comment.status());
        assert_eq!(timestamp(4), comment.updated_at());
    }

    #[test]
    fn comment_rejects_updates_before_created_timestamp() {
        let mut comment = comment_with_id("comment-1");
        let result = comment.resolve(timestamp(0));

        assert_eq!(Err(CommentDomainError::UpdatedBeforeCreated), result);
    }
}
