# P2.5 Comment Storage Paths

## Tasks

- [x] Resolve `.comments/<logical-file>.json` for `.plugin-workspace` specs.
- [x] Resolve `.comments/<logical-file>.json` for `.spec-skill` compatibility specs.
- [x] Ensure comment storage stays inside the selected spec folder.
- [x] Create `.comments/` on first write.
- [x] Read missing comment file as an empty list.
- [x] Preserve unknown files in `.comments/`.

## Done When

- Comment files are stored beside the spec but never modify Markdown content.

## Completion Note

Implemented infrastructure-level comment storage path resolution for `.plugin-workspace` and `.spec-skill` layouts, shared safe spec-id path validation, `.comments/` directory creation for first writes, and tests for missing JSON paths, traversal/absolute/backslash/NUL rejection, nested specs, and preserving unknown files. Repository JSON read/write operations remain scoped to P2.6. Verified with `cargo fmt` and `cargo test`.
Commit: b10e421d853fa76a89b2dc081a862a03a24728a5
