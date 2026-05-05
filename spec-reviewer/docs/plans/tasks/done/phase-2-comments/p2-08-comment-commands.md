# P2.8 Comment Commands

## Tasks

- [x] Add `presentation/commands/comments.rs`.
- [x] Add request DTO for listing comments.
- [x] Add request DTO for adding a comment.
- [x] Add request DTO for patching a comment.
- [x] Add request DTO for deleting a comment.
- [x] Add response DTO for comments.
- [x] Register comment commands in `lib.rs`.
- [x] Keep command DTOs separate from domain entities.

## Done When

- Frontend can invoke comment list, add, update, and delete commands.

## Completion Note

Implemented comment command DTOs and Tauri handlers for list, add, update, delete, resolve, reopen, and toggle flows. Registered commands in the Tauri invoke handler and added presentation DTO conversion tests. Implementation commit: this commit.
