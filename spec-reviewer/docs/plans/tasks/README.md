# Task files

This folder contains implementation tasks split into small, commit-sized Markdown files.

## Groups

- [phase-1-viewer](./phase-1-viewer/): workspace loading, spec tree, Markdown viewer, and initial UI.
- [phase-2-comments](./phase-2-comments/): comment domain, persistence, commands, and UI.
- [phase-3-anchors](./phase-3-anchors/): Markdown block parsing, anchor resolution, orphan handling, and refresh.
- [later-phases](./later-phases/): UX polish, export, AI integration, and release tasks.
- [done](./done/): completed task files moved out of active task groups.

## Completion Rule

When a task is finished:

1. Mark the task file's checklist items as complete.
2. Add a short completion note with the implementation commit or PR when available.
3. Move the task file from `tasks/<group>/` to `tasks/done/<group>/`.
4. Remove the task from the active group's `README.md`.
5. Add the moved task link to `tasks/done/README.md`.

Keep completed task files in `done/` instead of deleting them.
