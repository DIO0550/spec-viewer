# P1.10 Presentation Commands

## Goal

Expose Phase 1 use cases through Tauri IPC commands.

## Tasks

- [ ] Add `presentation/commands/workspace.rs`.
- [ ] Add `presentation/commands/specs.rs`.
- [ ] Define request DTOs for workspace path, spec id, and file key.
- [ ] Define response DTOs for workspace, spec tree, and Markdown file content.
- [ ] Convert app errors to serializable command errors.
- [ ] Register commands in `lib.rs`.
- [ ] Remove or isolate the starter `greet` command.

## Done When

- Frontend can invoke workspace load, spec list, and Markdown read commands.
- Command DTOs do not leak domain internals unnecessarily.

