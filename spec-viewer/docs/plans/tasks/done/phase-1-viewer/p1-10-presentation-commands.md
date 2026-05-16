# P1.10 Presentation Commands

## Goal

Expose Phase 1 use cases through Tauri IPC commands.

## Tasks

- [x] Add `presentation/commands/workspace.rs`.
- [x] Add `presentation/commands/specs.rs`.
- [x] Define request DTOs for workspace path, spec id, and file key.
- [x] Define response DTOs for workspace, spec tree, and Markdown file content.
- [x] Convert app errors to serializable command errors.
- [x] Register commands in `lib.rs`.
- [x] Remove or isolate the starter `greet` command.

## Done When

- Frontend can invoke workspace load, spec list, and Markdown read commands.
- Command DTOs do not leak domain internals unnecessarily.

## Completion Note

Implemented Tauri presentation commands and frontend-facing DTO/error mappings for workspace loading, spec listing, and Markdown file reads. Registered the commands in place of the starter `greet` command.

Implementation commit: `6c71e1e`.
