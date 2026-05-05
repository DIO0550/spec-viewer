# spec-reviewer implementation plans

This folder contains the implementation plan and task breakdown for `spec-reviewer`.

## Files

- [00-design-init.md](./00-design-init.md): product and implementation adjustments derived from the design HTML.
- [01-implementation-plan.md](./01-implementation-plan.md): end-to-end implementation strategy.
- [02-phase-1-viewer-tasks.md](./02-phase-1-viewer-tasks.md): foundation tasks for project loading, feature listing, tabs, and Markdown viewing.
- [03-phase-2-comments-tasks.md](./03-phase-2-comments-tasks.md): comment data, JSON storage, IPC, and UI tasks.
- [04-phase-3-anchors-tasks.md](./04-phase-3-anchors-tasks.md): anchor resolution, orphan handling, and file watching tasks.
- [05-later-phases-tasks.md](./05-later-phases-tasks.md): UX improvements, export, config overrides, and future AI integration.
- [06-acceptance-checklist.md](./06-acceptance-checklist.md): validation checklist before merging implementation work.
- [tasks/](./tasks/): task breakdown split into small, commit-sized Markdown files.

## Current Status

Phase 0 is complete: the Tauri, React, TypeScript, pnpm, Storybook, Vitest, Tailwind, Oxlint, Biome, and Rust dependency foundation exists.
The `/workspace/md-viewer-app Design.html` brief has been initialized into the docs and should guide the first UI implementation.
