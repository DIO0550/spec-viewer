# P4.4 Drag And Drop Workspace Open

## Tasks

- [x] Add frontend drop zone handling.
- [x] Validate dropped item is a directory.
- [x] Call workspace load use case with dropped path.
- [x] Show invalid drop feedback.
- [x] Preserve current workspace if dropped path fails.
- [x] Add manual QA scenario.

## Completion Note

Implemented app-wide workspace folder drag-and-drop with Tauri native drop path handling, browser path fallback, directory validation, invalid drop feedback, and current-workspace preservation on failed dropped workspace loads.

Implementation commit: fc86146
Test commit: e2c6802

Manual QA: `pnpm run build-storybook` completed successfully. `playwright-cli open http://localhost:6006/iframe.html?id=app--default` was attempted against local Storybook, but Chromium Chrome was unavailable at `/opt/google/chrome/chrome`.
