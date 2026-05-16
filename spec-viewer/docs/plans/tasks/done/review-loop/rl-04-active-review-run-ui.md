# RL.4 Active Review Run UI

## Tasks

- [x] Add `useReviewRuns` hook.
- [x] Add review run IPC wrappers in `src/lib/tauri.ts`.
- [x] Add Japanese `レビュー作成` action near comment export controls.
- [x] Add execution target choice: `現在のワークスペース` or `新しいworktree`.
- [x] Let users create a run from open comments for file/spec scope.
- [x] Show created active folder path after export with Japanese feedback copy.
- [x] Show worktree branch/path metadata when applicable.
- [x] Add active review run list with refresh and copy path actions.
- [x] Add Japanese loading, empty, success, and error states.

## Acceptance Criteria

- Users can create an active review run from the current reviewed file.
- Users can copy the active folder path for an external AI agent.
- Users can choose worktree mode when the selected workspace is a Git repository.
- User-facing labels and status messages in the review loop are Japanese-first.
- Existing comment export and prompt actions continue to work.
- Component tests cover disabled and error states.

## Completion Note

Implemented the active review run UI with a `useReviewRuns` hook, Japanese-first `ReviewRunPanel`, file/spec target and execution mode selection, active run refresh/copy actions, source file and worktree metadata display, and typed list/create IPC coverage. Added backend `list_review_runs` support so refresh can read active bundles from disk. Implementation commit: this commit.
