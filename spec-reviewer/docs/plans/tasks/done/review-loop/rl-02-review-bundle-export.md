# RL.2 Review Bundle Export

## Tasks

- [x] Add `create_review_run` Tauri command.
- [x] Reuse existing comment listing and anchor resolution.
- [x] Read source Markdown context for the selected target.
- [x] Resolve the target spec-driven-dev spec folder.
- [x] Resolve the execution target spec folder from current workspace or worktree metadata.
- [x] Write `manifest.json`.
- [x] Write `instructions.md`.
- [x] Write `comments.json`.
- [x] Write `context/<spec-id>/<file-key>.md` snapshots.
- [x] Write `result.md` template.
- [x] Write `status.json`.

## Acceptance Criteria

- Creating a review run creates a new folder under `<spec-folder>/user-review/active/<review-run-id>/`.
- Worktree mode writes the review run under the worktree's spec folder.
- The original Markdown files are not modified during export.
- The bundle tells AI agents to edit source spec Markdown, not context snapshots.
- `instructions.md` and `result.md` are Japanese-first templates.
- Export failures leave no partial active run when cleanup is possible.

## Completion Note

Implemented on main in commit `1a4a520`. Added the `create_review_run` command, current-workspace bundle export use case, temporary-directory bundle writer, Japanese-first instructions/result templates, `comments.json`/context/status/manifest artifacts, IPC wrapper coverage, and Rust coverage for successful export plus no-partial-run failures. Worktree creation/isolation remains in RL.3.
