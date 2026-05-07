# P7.2 Markdown Copy Selection Reliability

## Goal

Make partial text copy from the Markdown viewer reliable. Users should be able to select and copy a specific range without the selection unexpectedly expanding from the top of the document.

## Tasks

- [x] Reproduce the selection issue in the Markdown viewer with rendered prose, headings, lists, and code blocks.
- [x] Identify whether the problem comes from viewer markup, selection handling, highlight overlays, CSS, or the copy action itself.
- [x] Ensure comment highlight overlays do not intercept normal drag selection or copy behavior.
- [x] Keep add-comment selection behavior working after fixing normal copy.
- [x] Add focused tests around selection state if the behavior is covered by frontend logic.
- [x] Add or update a Storybook/Playwright check for partial text selection in the viewer.
- [x] Verify copy behavior with no comments, with resolved comments, and with active highlights.

## Acceptance Criteria

- Drag-selecting a paragraph fragment copies only the selected text.
- Selection does not jump to the start of the Markdown document.
- Existing text-selection-to-comment flow still works.
- Highlight rendering remains visually aligned after the fix.

## Notes

- Prefer fixing the selection source rather than adding a custom clipboard path unless the browser/Tauri behavior requires it.
- Pay close attention to absolutely positioned highlight elements and any `user-select` CSS.

## Completion Note

Implemented in commit `1bc7d97` by keeping highlighted Markdown selectable, ignoring highlight activation clicks while text is selected, and adding focused component and Storybook coverage for partial selection inside an active highlight.
