# Design references

This folder contains current product contracts and the source material that shaped
`spec-viewer`.

## Current contracts

- [Specs / Diff integrated review Phase 1 contract](./integrated-review-contract.md):
  canonical ADR mapping, domain boundaries, frontend state, IPC, persistence, errors,
  scope, and test fixtures.
- [Repository diff backend contract](./repository-diff-contract.md): Git comparison,
  snapshot, tree/content limits, typed outcomes, and Diff comment integration.

The user-facing entry point is
[Specs / Diff integrated review guide](../integrated-review-guide.md).

## Sources

- [Markdown viewer design brief](./md-viewer-app-design-brief.md)
- `/workspace/md-viewer-app Design.html`

The HTML file references `design-canvas.jsx` and `variations.jsx`, but those files are
not present in the workspace. The available embedded brief still provides product
direction, layout requirements, and visual exploration names.

## Architecture

- [Frontend architecture guidelines](./frontend-architecture-guidelines.md)
