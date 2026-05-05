# P1.8 Infrastructure: Markdown Read

## Goal

Safely read a configured Markdown file for the selected spec and logical file key.

## Tasks

- [ ] Resolve a spec file path from workspace root, spec id, and file key.
- [ ] Prevent reads outside the workspace root.
- [ ] Return a not-found result for missing configured files.
- [ ] Read Markdown as UTF-8.
- [ ] Return typed errors for invalid paths and unreadable files.
- [ ] Add tests for valid read, missing file, and traversal attempts.

## Done When

- Path traversal attempts are rejected.
- Missing Markdown files produce UI-friendly responses.

