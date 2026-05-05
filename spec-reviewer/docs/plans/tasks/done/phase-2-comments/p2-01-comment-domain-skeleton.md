# P2.1 Comment Domain Skeleton

## Tasks

- [x] Create `src-tauri/src/domain/comment/mod.rs`.
- [x] Add `CommentId` value object.
- [x] Add `CommentBody` value object.
- [x] Add `CommentStatus` enum.
- [x] Add `Comment` entity.
- [x] Add `CommentThread` domain type if multiple replies are supported.
- [x] Add comment domain errors.

## Done When

- Comment domain types compile without depending on Tauri or filesystem details.

## Completion Note

Implemented the pure comment domain skeleton with comment ids, bodies, status, anchors, comments, threads, and domain validation tests. Verified with `cargo fmt` and `cargo test`.
Commit: P2.1 task completion commit.
