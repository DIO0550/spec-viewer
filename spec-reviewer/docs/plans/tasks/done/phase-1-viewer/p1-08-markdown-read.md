# P1.8 Infrastructure: Markdown Read

## Goal

Safely read a configured Markdown file for the selected spec and logical file key.

## Tasks

- [x] Resolve a spec file path from workspace root, spec id, and file key.
- [x] Prevent reads outside the workspace root.
- [x] Return a not-found result for missing configured files.
- [x] Read Markdown as UTF-8.
- [x] Return typed errors for invalid paths and unreadable files.
- [x] Add tests for valid read, missing file, and traversal attempts.

## Done When

- Path traversal attempts are rejected.
- Missing Markdown files produce UI-friendly responses.

## Completion Note

Implemented in this commit. Added `FilesystemMarkdownReader` with safe spec path resolution, workspace escape checks, UTF-8 decoding, typed read errors, and tempdir-backed unit tests.
