# P4.14 Collapsible Left Navigation

## Goal

Make the left spec navigation pane collapsible and default it to closed. Users usually review the selected Markdown file, so the file/spec tree should stay out of the way until they need to switch specs or files.

## Tasks

- [x] Add left navigation open/closed state.
- [x] Default the left navigation to closed for first-time app users.
- [x] Persist the user's left navigation preference after they manually open or close it.
- [x] Add a toolbar/icon button to open the left navigation.
- [x] Add a close button inside the left navigation.
- [x] Add a draggable resize handle between the left navigation and Markdown pane.
- [x] Persist the user's left navigation width separately from open/closed state.
- [x] Constrain the left navigation width with sane min/default/max values.
- [x] Restore a sane default width if the saved width no longer fits the viewport.
- [x] Keep the selected workspace, spec, and file state when the left navigation is closed.
- [x] Ensure the Markdown reading pane expands when the left navigation is closed.
- [x] Treat the left navigation as an overlay or drawer on narrow viewports.
- [x] Allow Escape to close the left navigation when focus is inside it or it is shown as an overlay.
- [x] Move focus predictably between open and close controls.
- [x] Add Japanese accessible labels and tooltips.
- [x] Add tests for default-closed state, open/close controls, preference persistence, Escape behavior, and layout expansion.

## UI Copy

Suggested Japanese labels:

| Concept | Label |
| --- | --- |
| Open left navigation | 仕様一覧を開く |
| Close left navigation | 仕様一覧を閉じる |
| Resize left navigation | 仕様一覧の幅を変更 |
| Spec list | 仕様一覧 |
| Current spec | 現在の仕様 |

## Acceptance Criteria

- On first launch, the left navigation is closed by default.
- Users can open the left navigation from the toolbar.
- Users can close the left navigation from inside the pane.
- Users can resize the left navigation by dragging its divider.
- The resized width is restored on reload.
- Closing the left navigation does not clear the selected spec or file.
- The Markdown pane uses the freed horizontal space while the left navigation is closed.
- The last manual open/closed choice is restored on reload.

## Notes

- This is independent from the right comment sidebar. The right sidebar can keep its own open/closed and width preferences.
- The left navigation width preference should be independent from the right sidebar width preference.
- The spec tree should still be available because users need it occasionally, but it should no longer dominate the default reading layout.

## Completion Note

Implemented the left navigation as a default-closed, persisted, resizable pane with toolbar open control, in-pane close control, Escape handling, focus handoff, and narrow-viewport drawer styling. Added state and layout tests plus separate preference/width hook coverage. Implementation commit hash is recorded in the final task handoff after commit creation.
