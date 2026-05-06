# RL.3 Worktree Isolation

## Tasks

- [ ] Detect whether the selected workspace is inside a Git repository.
- [ ] Define deterministic review branch names such as `spec-reviewer/<review-run-id>`.
- [ ] Define default worktree location outside the current workspace tree.
- [ ] Detect uncommitted changes for source files included in the review run.
- [ ] Add worktree path validation and conflict checks.
- [ ] Add backend adapter for `git worktree add`.
- [ ] Record repository path, worktree path, and branch name in `manifest.json`.
- [ ] Write review bundles into the worktree spec folder when worktree mode is selected.
- [ ] Leave merge, rebase, prune, and worktree deletion out of the first version.

## Acceptance Criteria

- Worktree mode creates an isolated checkout for the review run.
- AI instructions point to source files inside the worktree, not the user's current workspace.
- Non-Git workspaces fail before any review bundle is written.
- Dirty target source files block worktree mode with an explanation.
- Existing branch or worktree path conflicts produce clear errors.
- Current-workspace mode still works without Git.
