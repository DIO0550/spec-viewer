# P2.2 Anchor Domain

## Tasks

- [x] Add `CommentAnchor` domain type.
- [x] Add `BlockType` enum.
- [x] Add `BlockIndex` value object.
- [x] Add `TextHash` value object.
- [x] Add `TextSnippet` value object.
- [x] Add `CharRange` value object.
- [x] Validate char range start/end ordering.

## Done When

- A comment can describe where it belongs without storing UI-only state.

## Completion Note

Implemented anchor domain value objects for block location, text matching, and character ranges. Verified with `cargo fmt` and `cargo test`.
Commit: 0ecb3a9f0d052fbda47733cf031d751d754618f8
