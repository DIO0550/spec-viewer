# P4.10 Collapsible Sidebar And Japanese UI

## Tasks

- [x] Add right sidebar expanded/collapsed state.
- [x] Add `サイドバーを閉じる` icon button in the right sidebar.
- [x] Add `サイドバーを開く` affordance when the sidebar is collapsed.
- [x] Persist sidebar open/closed preference.
- [x] Expand the Markdown pane when the sidebar is closed.
- [x] Add narrow viewport overlay behavior and Escape dismissal.
- [x] Preserve active comment, filters, search, and review-run state while hidden.
- [x] Add typed Japanese UI text constants.
- [x] Migrate high-traffic app shell, comment sidebar, and user-review labels to Japanese.
- [x] Add Japanese loading, empty, success, and error messages for the main reviewer flow.
- [x] Add tests for sidebar states, preference persistence, keyboard behavior, and Japanese labels.
- [x] Verify text fitting and non-overlap in desktop and narrow viewports.

## Acceptance Criteria

- Users can close and reopen the right sidebar without losing review state.
- Markdown content gains usable width when the sidebar is closed.
- Narrow viewports can dismiss the sidebar without layout overlap.
- Primary visible UI for the reviewer workflow is Japanese.
- Icon-only controls have Japanese accessible labels.
- Existing comment creation, export, prompt, and user-review actions continue to work.

## Notes

- Keep persisted JSON schema keys, IPC command names, and TypeScript/Rust identifiers in English.
- Keep technical product terms such as `worktree`, `Markdown`, `JSON`, and `user-review` in English where clearer.

## Completion Note

Implemented collapsible comment sidebar state with persisted preference, desktop rail and narrow viewport overlay behavior, Escape dismissal, typed Japanese UI text constants, and Japanese reviewer workflow copy. Verified with unit tests, typecheck, lint, format check, package check, and Storybook build. Commit: `8f183e6`.
