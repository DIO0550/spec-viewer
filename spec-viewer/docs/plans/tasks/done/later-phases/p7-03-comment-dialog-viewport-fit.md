# P7.3 Comment Dialog Viewport Fit

## Goal

Keep the comment entry dialog fully usable at smaller window sizes. The dialog should not clip primary actions such as `追加`, and users should always be able to submit or cancel without resizing the app.

## Tasks

- [x] Reproduce the clipped dialog with a small desktop viewport and a long selected Markdown excerpt.
- [x] Constrain the dialog height relative to the viewport and allow only the body content to scroll.
- [x] Keep the footer actions visible or reachable when the selected excerpt and textarea content are long.
- [x] Verify focus management still lands on the comment field and returns to the viewer after closing.
- [x] Preserve keyboard submit/cancel behavior if it already exists.
- [x] Update component styling without introducing nested card layouts.
- [x] Add Storybook/Playwright coverage for the small-viewport dialog state.

## Acceptance Criteria

- The `追加` and cancel actions remain visible or reachable in a small app window.
- Long selected excerpts do not push dialog actions off-screen.
- The textarea remains comfortable to edit and does not resize the whole dialog past the viewport.
- Existing add-comment behavior and validation are unchanged.

## Notes

- A sticky footer inside the dialog is acceptable if it matches the existing visual system.
- Use responsive constraints such as `max-height`, internal scrolling, and stable footer sizing rather than viewport-scaled fonts.

## Completion Note

Implemented in commit `1bc7d97` by clamping the floating comment dialog to the viewport, separating the scrollable body from footer actions, preserving focus and keyboard behavior, and adding component and Storybook coverage for the small-viewport structure.
