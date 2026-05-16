# P2.6 Comment Store Implementation

## Tasks

- [x] Implement JSON read.
- [x] Implement JSON write.
- [x] Implement temp-file then rename write flow.
- [x] Implement duplicate ID guard.
- [x] Implement update by ID.
- [x] Implement delete by ID.
- [x] Return typed errors for malformed JSON.
- [x] Return typed errors for missing comment IDs.

## Done When

- Add, update, delete, and list operations are covered by Rust tests.

## Completion Note

Implemented the JSON-backed `JsonCommentRepository` using the P2.3 repository contract, P2.4 comment JSON format, and P2.5 storage path resolver. The store supports list/add/update/delete, missing-file reads as empty, duplicate ID guards, scope validation, malformed JSON errors, missing ID errors, temp-file then rename writes, and preserves unknown `.comments/` files plus existing unknown JSON metadata where possible. Verified with `cargo fmt` and `cargo test`.
Commit: 60f6bfef2c0f0c5a982f5dd965b34e014433f600
