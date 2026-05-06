# RL.2 Review Bundle Export

## Tasks

- [ ] Add `create_review_run` Tauri command.
- [ ] Reuse existing comment listing and anchor resolution.
- [ ] Read source Markdown context for the selected target.
- [ ] Resolve the target spec-driven-dev spec folder.
- [ ] Resolve the execution target spec folder from current workspace or worktree metadata.
- [ ] Write `manifest.json`.
- [ ] Write `instructions.md`.
- [ ] Write `comments.json`.
- [ ] Write `context/<spec-id>/<file-key>.md` snapshots.
- [ ] Write `result.md` template.
- [ ] Write `status.json`.

## Acceptance Criteria

- Creating a review run creates a new folder under `<spec-folder>/user-review/active/<review-run-id>/`.
- Worktree mode writes the review run under the worktree's spec folder.
- The original Markdown files are not modified during export.
- The bundle tells AI agents to edit source spec Markdown, not context snapshots.
- `instructions.md` and `result.md` are Japanese-first templates.
- Export failures leave no partial active run when cleanup is possible.
