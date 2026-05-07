# P7.1 Worktree Plugin Worktree Discovery

## Goal

Detect spec-driven-dev workspaces stored under Claude worktrees, especially `.claude/worktrees/{worktree-name}/.plugin-worktree`, so users can review specs created in isolated worktrees without manually opening each hidden directory.

## Tasks

- [x] Reproduce the current discovery gap with a fixture shaped like `.claude/worktrees/{worktree-name}/.plugin-worktree/.specs/`.
- [x] Decide whether discovery should happen from the repository root, the `.claude/` directory, or a directly opened `.plugin-worktree` directory.
- [x] Extend workspace detection or spec scanning to include `.claude/worktrees/*/.plugin-worktree` when the user opens a parent workspace.
- [x] Reuse existing spec-driven-dev file mapping for `.plugin-worktree` specs, including `hearing-notes.md`, `exploration-report.md`, `implementation-plan.md`, and `tasks.md`.
- [x] Preserve existing behavior for `.plugin-workspace`, `.spec-skill`, and directly opened workspace directories.
- [x] Add Rust coverage for the new worktree discovery fixture.
- [x] Update frontend display data if the tree needs to show the worktree name or nested source path.
- [x] Run workspace detection, spec scanning, and relevant frontend state tests.

## Acceptance Criteria

- Opening a repository that contains `.claude/worktrees/{worktree-name}/.plugin-worktree/.specs/` surfaces those specs in the app.
- Opening `.claude/worktrees/{worktree-name}/.plugin-worktree` directly still works.
- Existing `.plugin-workspace` and `.spec-skill` workspaces are unaffected.
- The UI makes the source worktree understandable enough to avoid confusing duplicate spec names.

## Notes

- Keep filesystem path handling in the infrastructure layer and convert to app/domain concepts at the existing boundaries.
- Avoid hard-coding a single worktree name; discovery should handle multiple worktrees.

## Completion Note

Implemented in commit `1f8cb54` by adding direct `.plugin-worktree` loading, repository-level Claude worktree discovery, source-labelled spec tree nodes, and Rust coverage for detection and scanning.
