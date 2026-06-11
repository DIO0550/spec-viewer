//! Comment thread aggregate.

use std::collections::HashSet;

use crate::domain::comment::{Comment, CommentDomainError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentThread {
    root: Comment,
    replies: Vec<Comment>,
}

impl CommentThread {
    pub fn new(root: Comment, replies: Vec<Comment>) -> Result<Self, CommentDomainError> {
        let mut seen_ids = HashSet::from([root.id().clone()]);

        for reply in &replies {
            if !seen_ids.insert(reply.id().clone()) {
                return Err(CommentDomainError::DuplicateCommentId {
                    id: reply.id().clone(),
                });
            }
        }

        Ok(Self { root, replies })
    }

    pub fn root(&self) -> &Comment {
        &self.root
    }

    pub fn replies(&self) -> &[Comment] {
        &self.replies
    }

    pub fn comments(&self) -> impl Iterator<Item = &Comment> {
        std::iter::once(&self.root).chain(self.replies.iter())
    }

    pub fn is_resolved(&self) -> bool {
        self.comments().all(Comment::is_resolved)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Utc};

    use crate::domain::{
        comment::{
            BlockIndex, BlockType, CharRange, CommentAnchor, CommentBody, CommentId, TextHash,
            TextSnippet,
        },
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
    fn comment_thread_keeps_root_and_replies() {
        let thread = CommentThread::new(
            comment_with_id("root"),
            vec![comment_with_id("reply-1"), comment_with_id("reply-2")],
        )
        .expect("thread should be valid");

        assert_eq!("root", thread.root().id().as_str());
        assert_eq!(2, thread.replies().len());
        assert_eq!(3, thread.comments().count());
        assert!(!thread.is_resolved());
    }

    #[test]
    fn comment_thread_is_resolved_when_all_comments_are_resolved() {
        let mut root = comment_with_id("root");
        root.resolve(timestamp(2)).expect("resolve should be valid");
        let mut reply = comment_with_id("reply-1");
        reply
            .resolve(timestamp(2))
            .expect("resolve should be valid");

        let thread = CommentThread::new(root, vec![reply]).expect("thread should be valid");

        assert!(thread.is_resolved());
    }

    #[test]
    fn comment_thread_rejects_duplicate_comment_ids() {
        let duplicate = CommentId::new("root").expect("id should be valid");
        let result = CommentThread::new(comment_with_id("root"), vec![comment_with_id("root")]);

        assert_eq!(
            Err(CommentDomainError::DuplicateCommentId { id: duplicate }),
            result
        );
    }
}
