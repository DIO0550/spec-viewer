# P1.7 Infrastructure: Spec Tree Scan

## Goal

Scan spec folders and return tree-compatible metadata for the frontend.

## Tasks

- [x] Scan `.plugin-workspace/.specs/` directories.
- [x] Preserve nested folders like `code-review/`.
- [x] Ignore hidden internal folders except required app-managed folders.
- [x] Scan `.spec-skill/features/` for compatibility mode.
- [x] Resolve configured Markdown files for each spec node.
- [x] Include missing-file status per logical file.
- [x] Sort folders and specs deterministically.
- [x] Add tests using temporary fixture directories.

## Done When

- The same fixture always returns the same ordered tree.
- Missing files are represented, not treated as fatal scan errors.

## Completion Note

Implemented filesystem spec tree scanning in commit `d23f825`.
