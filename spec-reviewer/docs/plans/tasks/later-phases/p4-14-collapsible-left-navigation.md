# P4.14 Collapsible Left Navigation

## Goal

Make the left spec navigation pane collapsible and default it to closed. Users usually review the selected Markdown file, so the file/spec tree should stay out of the way until they need to switch specs or files.

## Tasks

- [ ] Add left navigation open/closed state.
- [ ] Default the left navigation to closed for first-time app users.
- [ ] Persist the user's left navigation preference after they manually open or close it.
- [ ] Add a toolbar/icon button to open the left navigation.
- [ ] Add a close button inside the left navigation.
- [ ] Add a draggable resize handle between the left navigation and Markdown pane.
- [ ] Persist the user's left navigation width separately from open/closed state.
- [ ] Constrain the left navigation width with sane min/default/max values.
- [ ] Restore a sane default width if the saved width no longer fits the viewport.
- [ ] Keep the selected workspace, spec, and file state when the left navigation is closed.
- [ ] Ensure the Markdown reading pane expands when the left navigation is closed.
- [ ] Treat the left navigation as an overlay or drawer on narrow viewports.
- [ ] Allow Escape to close the left navigation when focus is inside it or it is shown as an overlay.
- [ ] Move focus predictably between open and close controls.
- [ ] Add Japanese accessible labels and tooltips.
- [ ] Add tests for default-closed state, open/close controls, preference persistence, Escape behavior, and layout expansion.

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
