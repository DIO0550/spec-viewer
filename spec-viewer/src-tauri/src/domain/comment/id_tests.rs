use uuid::Uuid;

use super::{CommentDomainError, CommentId};

#[test]
fn generated_comment_id_preserves_the_existing_wire_format() {
    let uuid =
        Uuid::parse_str("67E55044-10B1-426F-9247-BB680E5FE0C8").expect("uuid should be valid");

    let id = CommentId::generate(uuid);

    assert_eq!("cmt_67e5504410b1426f9247bb680e5fe0c8", id.as_str());
}

#[test]
fn restored_comment_id_keeps_accepting_legacy_wire_values() {
    let id = CommentId::new("legacy-comment-17").expect("legacy comment id should remain valid");

    assert_eq!("legacy-comment-17", id.as_str());
}

#[test]
fn restored_comment_id_still_rejects_missing_values() {
    let result = CommentId::new("   ");

    assert_eq!(Err(CommentDomainError::MissingCommentId), result);
}
