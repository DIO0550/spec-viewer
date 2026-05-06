# RL.4 Active Review Run UI

## Tasks

- [ ] Add `useReviewRuns` hook.
- [ ] Add review run IPC wrappers in `src/lib/tauri.ts`.
- [ ] Add Japanese `レビュー作成` action near comment export controls.
- [ ] Add execution target choice: `現在のワークスペース` or `新しいworktree`.
- [ ] Let users create a run from open comments for file/spec scope.
- [ ] Show created active folder path after export with Japanese feedback copy.
- [ ] Show worktree branch/path metadata when applicable.
- [ ] Add active review run list with refresh and copy path actions.
- [ ] Add Japanese loading, empty, success, and error states.

## Acceptance Criteria

- Users can create an active review run from the current reviewed file.
- Users can copy the active folder path for an external AI agent.
- Users can choose worktree mode when the selected workspace is a Git repository.
- User-facing labels and status messages in the review loop are Japanese-first.
- Existing comment export and prompt actions continue to work.
- Component tests cover disabled and error states.
