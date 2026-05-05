# P1.12 Frontend State Hooks

## Goal

Centralize workspace, spec selection, tab selection, and Markdown loading state.

## Tasks

- [x] Add `src/hooks/useWorkspace.ts`.
- [x] Add workspace path state.
- [x] Add workspace loading/error state.
- [x] Add `src/hooks/useSpecs.ts`.
- [x] Add selected spec state.
- [x] Add selected file key state.
- [x] Add Markdown content loading/error state.
- [x] Reset selected spec and file when workspace changes.

## Done When

- App-level components stay mostly declarative.
- Workspace changes consistently reset dependent state.

## Completion Note

Implemented frontend workspace and spec state hooks with typed loading, error, empty, ready, and missing states. Added hook tests covering workspace load success/failure, spec tree empty state, Markdown ready/missing states, and selection reset on workspace changes.

Implementation commit: `597bc164e31ef095d44fde6c0ee3eea05cecfe16`.
