# spec-reviewer implementation plan

## Goal

Build a Tauri desktop app for reviewing spec Markdown files without modifying the Markdown source files. The app should open a workspace containing either `.plugin-workspace/.specs/` or `.spec-skill/`, list specs/features, render configured Markdown files, and manage comments in separate JSON files.

## Architecture

- Rust owns filesystem access, workspace detection, config resolution, spec scanning, Markdown reads, comment JSON I/O, and anchor resolution.
- React owns layout, selection behavior, Markdown rendering, comment UI, filters, and application state.
- Tauri IPC is the boundary between UI and filesystem behavior.
- Markdown files remain read-only from the app's comment workflow.

## Data Model

The design source prefers these logical Markdown files:

- `exploration`
- `hearing`
- `impl`
- `tasks`

Compatibility mode may also support the earlier logical spec files:

- `requirements`
- `design`
- `tasks`

Workspace config maps logical keys to actual filenames. The implementation should not hard-code the visible tabs to only one file set.

```json
{
  "files": {
    "exploration": "exploration-report.md",
    "hearing": "hearing-notes.md",
    "impl": "implementation-plan.md",
    "tasks": "tasks.md"
  }
}
```

Comments are stored per spec/feature and logical file:

```text
<spec-folder>/.comments/<logical-file>.json
```

Comment records should include:

- `id`
- `anchor`
- `body`
- `resolved`
- `createdAt`
- `updatedAt`

## Implementation Order

1. Build the viewer foundation: workspace open, workspace detection, spec tree scan, Markdown load, tabs, and rendered view.
2. Add comment persistence: shared types, JSON store, IPC commands, comment sidebar, and resolved state.
3. Add text selection and highlight UI: selection capture, anchor creation, comment creation flow, and visible highlights.
4. Harden anchors: Rust block parsing, text hash fallback, fuzzy snippet fallback, orphan handling, and file-change refresh.
5. Improve UX: filters, search, theme, drag and drop, config overrides, and export.

## Non-goals For Initial Implementation

- Editing Markdown content directly.
- Direct Markdown editing.
- AI-assisted rewrite application.
- Multi-user synchronization.
