# P2.7 Comment Use Cases

## Tasks

- [x] Add `list_comments` use case.
- [x] Add `add_comment` use case.
- [x] Add `update_comment` use case.
- [x] Add `delete_comment` use case.
- [x] Add `toggle_comment_resolved` helper if useful.
- [x] Generate IDs in the application layer.
- [x] Generate timestamps in the application layer.
- [x] Validate body is non-empty before persistence.

## Done When

- Comment behavior is orchestrated outside presentation commands.

## Completion Note

Implemented app-layer comment use cases for list/add/update/delete/resolve/reopen/toggle using the domain repository contract, with filesystem wiring through `JsonCommentRepository`. Added fake repository tests for orchestration, app-generated IDs/timestamps, body validation before persistence, and status transitions. Verified with `cargo fmt` and `cargo test`.
