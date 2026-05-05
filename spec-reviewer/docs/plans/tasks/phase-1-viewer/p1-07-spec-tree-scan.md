# P1.7 Infrastructure: Spec Tree Scan

## Goal

Scan spec folders and return tree-compatible metadata for the frontend.

## Tasks

- [ ] Scan `.plugin-workspace/.specs/` directories.
- [ ] Preserve nested folders like `code-review/`.
- [ ] Ignore hidden internal folders except required app-managed folders.
- [ ] Scan `.spec-skill/features/` for compatibility mode.
- [ ] Resolve configured Markdown files for each spec node.
- [ ] Include missing-file status per logical file.
- [ ] Sort folders and specs deterministically.
- [ ] Add tests using temporary fixture directories.

## Done When

- The same fixture always returns the same ordered tree.
- Missing files are represented, not treated as fatal scan errors.

