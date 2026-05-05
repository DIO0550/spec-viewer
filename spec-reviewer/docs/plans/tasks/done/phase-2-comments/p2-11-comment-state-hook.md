# P2.11 Comment State Hook

## Tasks

- [x] Add `src/hooks/useComments.ts`.
- [x] Load comments when selected workspace/spec/file changes.
- [x] Track loading state.
- [x] Track save/update/delete state.
- [x] Track command errors.
- [x] Add optimistic update for resolve toggle.
- [x] Roll back optimistic update on failure.
- [x] Refetch after destructive operations if needed.

## Done When

- Comment data flow is reusable across sidebar, highlights, and popovers.

## Completion Note

Implemented `useComments` with scoped comment loading, typed list/mutation states, add/update/delete/resolve/reopen/toggle actions, optimistic resolve toggling with rollback, and hook coverage for scope reset/refetch and error paths. Implementation commit: this commit.
