# P1.15 Viewer UI Behavior

## Goal

Make the viewer workflow usable from app launch through Markdown reading.

## Tasks

- [x] Start with an open-workspace empty state.
- [x] Open workspace with `@tauri-apps/plugin-dialog`.
- [x] Load spec tree after selecting a valid workspace.
- [x] Select the first available spec by default.
- [x] Select the first available file tab by default.
- [x] Show missing-file empty state for absent configured files.
- [x] Show active workspace path in a footer or toolbar.
- [x] Keep the right sidebar reserved for comments.

## Done When

- A user can open a supported workspace and read Markdown without using dev tools.

## Completion Note

Implemented native workspace opening, default spec/file selection, missing/loading/error state handling, keyboard-friendly tree and tab navigation, viewer scroll/focus reset, and the reserved comments sidebar in the P1.15 completion commit.
