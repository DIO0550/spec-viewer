# P4.11 Resizable Sidebar And Comment Entry UX

## Tasks

- [x] Add a draggable resize handle between the Markdown pane and the right sidebar.
- [x] Constrain sidebar width with min/default/max values.
- [x] Persist sidebar width separately from open/closed state.
- [x] Restore a safe width when viewport size changes.
- [x] Keep narrow viewport overlay behavior usable without horizontal overflow.
- [x] Add Japanese accessible label `サイドバー幅を変更` for the resize handle.
- [x] Add a clear empty-state hint: `Markdown本文の行にあるコメントボタンから追加できます`.
- [x] Add a Kiro-like line/block comment affordance in the Markdown viewer gutter.
- [x] Keep line/block click as the primary comment creation path.
- [x] Keep text selection as a secondary precision comment path.
- [x] Ensure the `コメント追加` affordance is visible on hover and keyboard focus.
- [x] Ensure the add-comment popover shows target line/block preview, body input, save, and cancel.
- [x] Document that generic unanchored comments are out of scope for the first workflow.
- [x] Add tests for resize constraints, persistence, viewport fallback, and comment-entry hints.

## Acceptance Criteria

- Users can resize the right sidebar without breaking the Markdown layout.
- Sidebar width is restored after reload and remains valid on smaller viewports.
- Users can understand how to add a comment from an empty comment sidebar.
- Comment creation remains anchored to a Markdown line/block by default.
- Text selection can still create precise range comments when needed.
- Japanese labels are used for resize and comment-entry affordances.
- Existing close/reopen sidebar behavior continues to work.

## Notes

- Suggested initial dimensions: default `360px`, minimum `280px`, maximum `min(560px, 45vw)`.
- Use pointer events for drag resizing and keyboard-accessible fallback controls if practical.
- Do not introduce unanchored comments until line/block anchored comments and user-review export remain clear.

## Completion Note

Implemented draggable and keyboard-accessible sidebar resizing, persisted constrained width, empty-comment guidance, and anchored Markdown block comment entry. Generic unanchored comments remain out of scope for this workflow.
