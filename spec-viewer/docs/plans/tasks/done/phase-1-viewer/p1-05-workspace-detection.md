# P1.5 Infrastructure: Workspace Detection

## Goal

Detect supported workspace layouts from a selected directory.

## Tasks

- [x] Add filesystem adapter to check path existence.
- [x] Detect `.plugin-workspace/.specs/`.
- [x] Detect `.spec-skill/features/`.
- [x] Prefer `.plugin-workspace/.specs/` when both exist.
- [x] Return `WorkspaceLayout` from infrastructure.
- [x] Add tests for each detection branch.

## Done When

- Detection works for plugin workspace, spec-skill workspace, both-present workspace, and unsupported workspace.

## Completion Note

Implemented workspace layout detection in the filesystem infrastructure and verified it with `cargo test`. Implementation commit: `f8a5948`.
