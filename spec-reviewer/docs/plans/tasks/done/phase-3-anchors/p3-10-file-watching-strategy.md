# P3.10 File Watching Strategy

## Tasks

- [x] Decide between Tauri fs plugin watch and `notify`.
- [x] Add backend watcher or frontend-triggered reload.
- [x] Watch current Markdown file.
- [x] Watch config file where practical.
- [x] Debounce rapid file changes.
- [x] Re-read Markdown after change.
- [x] Re-resolve comments after change.
- [x] Surface reload errors in UI.

## Done When

- Current Markdown changes can refresh without restarting the app.

## Completion Note

Implemented a `notify`-based backend watcher with debounced change events, frontend event subscription, and automatic Markdown/comment reload for the active file. Implementation commit: this P3.10 commit.
