use chrono::{DateTime, Utc};

use super::{
    BlockIndex, BlockType, CharRange, Comment, CommentAnchor, CommentBody, CommentId, CommentScope,
    CommentStatus, ScopedComments, ScopedCommentsError, TextHash, TextSnippet,
};
use crate::domain::spec::{SpecFileKey, SpecId};

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

fn comment(id: &str, file_key: SpecFileKey, body: &str, updated_at: u32) -> Comment {
    Comment::restore(
        CommentId::new(id).expect("comment id should be valid"),
        CommentAnchor::new(
            file_key,
            BlockType::Paragraph,
            BlockIndex::new(1),
            TextHash::new("hash").expect("hash should be valid"),
            TextSnippet::new("selected text").expect("snippet should be valid"),
            CharRange::new(0, 8).expect("range should be valid"),
        ),
        CommentBody::new(body).expect("body should be valid"),
        CommentStatus::Open,
        timestamp(1),
        timestamp(updated_at),
    )
    .expect("comment should be valid")
}

#[test]
fn scoped_comments_restore_rejects_comment_from_another_file() {
    let result = ScopedComments::restore(
        scope(SpecFileKey::Impl),
        vec![comment("cmt_other", SpecFileKey::Tasks, "Other", 1)],
    );

    assert_eq!(
        Err(ScopedCommentsError::ScopeMismatch {
            expected_file_key: SpecFileKey::Impl,
            actual_file_key: SpecFileKey::Tasks,
        }),
        result
    );
}

#[test]
fn scoped_comments_restore_rejects_duplicate_ids() {
    let duplicate = CommentId::new("cmt_duplicate").expect("comment id should be valid");
    let result = ScopedComments::restore(
        scope(SpecFileKey::Impl),
        vec![
            comment("cmt_duplicate", SpecFileKey::Impl, "First", 1),
            comment("cmt_duplicate", SpecFileKey::Impl, "Second", 2),
        ],
    );

    assert_eq!(
        Err(ScopedCommentsError::DuplicateComment { id: duplicate }),
        result
    );
}

#[test]
fn scoped_comments_owns_add_update_and_delete_rules() {
    let scope = scope(SpecFileKey::Impl);
    let first = comment("cmt_first", SpecFileKey::Impl, "First", 1);
    let second = comment("cmt_second", SpecFileKey::Impl, "Second", 1);
    let updated = comment("cmt_first", SpecFileKey::Impl, "Updated", 2);
    let mut comments =
        ScopedComments::restore(scope.clone(), vec![first]).expect("aggregate should restore");

    assert_eq!(Ok(second.clone()), comments.add(second.clone()));
    assert_eq!(Ok(updated.clone()), comments.update(updated.clone()));
    assert_eq!(Ok(second.clone()), comments.delete(second.id()));
    assert_eq!(&scope, comments.scope());
    assert_eq!(&[updated], comments.comments());
}

#[test]
fn scoped_comments_rejects_duplicate_add_without_mutation() {
    let first = comment("cmt_duplicate", SpecFileKey::Impl, "First", 1);
    let duplicate = comment("cmt_duplicate", SpecFileKey::Impl, "Duplicate", 2);
    let mut comments = ScopedComments::restore(scope(SpecFileKey::Impl), vec![first.clone()])
        .expect("aggregate should restore");

    assert_eq!(
        Err(ScopedCommentsError::DuplicateComment {
            id: duplicate.id().clone(),
        }),
        comments.add(duplicate)
    );
    assert_eq!(&[first], comments.comments());
}

#[test]
fn scoped_comments_rejects_stale_update_without_mutation() {
    let current = comment("cmt_stale", SpecFileKey::Impl, "Current", 3);
    let stale = comment("cmt_stale", SpecFileKey::Impl, "Stale", 2);
    let mut comments = ScopedComments::restore(scope(SpecFileKey::Impl), vec![current.clone()])
        .expect("aggregate should restore");

    assert_eq!(
        Err(ScopedCommentsError::StaleUpdate {
            id: stale.id().clone(),
            current: timestamp(3),
            attempted: timestamp(2),
        }),
        comments.update(stale)
    );
    assert_eq!(&[current], comments.comments());
}

#[test]
fn scoped_comments_returns_typed_not_found_errors() {
    let missing = CommentId::new("cmt_missing").expect("comment id should be valid");
    let replacement = comment("cmt_missing", SpecFileKey::Impl, "Missing", 2);
    let mut comments =
        ScopedComments::restore(scope(SpecFileKey::Impl), Vec::new()).expect("empty is valid");

    assert_eq!(
        Err(ScopedCommentsError::CommentNotFound {
            id: missing.clone(),
        }),
        comments.update(replacement)
    );
    assert_eq!(
        Err(ScopedCommentsError::CommentNotFound {
            id: missing.clone(),
        }),
        comments.delete(&missing)
    );
    assert!(comments.comments().is_empty());
}
