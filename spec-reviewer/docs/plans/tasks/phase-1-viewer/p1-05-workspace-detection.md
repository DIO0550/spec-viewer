# P1.5 Infrastructure: Workspace Detection

## Goal

Detect supported workspace layouts from a selected directory.

## Tasks

- [ ] Add filesystem adapter to check path existence.
- [ ] Detect `.plugin-workspace/.specs/`.
- [ ] Detect `.spec-skill/features/`.
- [ ] Prefer `.plugin-workspace/.specs/` when both exist.
- [ ] Return `WorkspaceLayout` from infrastructure.
- [ ] Add tests for each detection branch.

## Done When

- Detection works for plugin workspace, spec-skill workspace, both-present workspace, and unsupported workspace.

