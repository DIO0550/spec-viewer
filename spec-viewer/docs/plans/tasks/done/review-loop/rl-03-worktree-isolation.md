# RL.3 Worktree Isolation

## Tasks

- [x] Detect whether the selected workspace is inside a Git repository.
- [x] Define deterministic review branch names such as `spec-reviewer/<review-run-id>`.
- [x] Define default worktree location outside the current workspace tree.
- [x] Detect uncommitted changes for source files included in the review run.
- [x] Add worktree path validation and conflict checks.
- [x] Add backend adapter for `git worktree add`.
- [x] Record repository path, worktree path, and branch name in `manifest.json`.
- [x] Write review bundles into the worktree spec folder when worktree mode is selected.
- [x] Leave merge, rebase, prune, and worktree deletion out of the first version.

## Acceptance Criteria

- Worktree mode creates an isolated checkout for the review run.
- AI instructions point to source files inside the worktree, not the user's current workspace.
- Non-Git workspaces fail before any review bundle is written.
- Dirty target source files block worktree mode with an explanation.
- Existing branch or worktree path conflicts produce clear errors.
- Current-workspace mode still works without Git.

## Completion Note

Implemented Git-backed worktree mode for review run creation. The implementation detects Git repositories, blocks dirty reviewed source files, creates deterministic `spec-reviewer/<review-run-id>` branches in sibling worktree checkouts, records worktree metadata in `manifest.json`, and writes bundles into the isolated spec folder while leaving current-workspace mode unchanged for non-Git workspaces. Merge/rebase/prune/delete flows remain intentionally out of scope for a future task.

Implementation commit: included in the commit that moved this task to done.
