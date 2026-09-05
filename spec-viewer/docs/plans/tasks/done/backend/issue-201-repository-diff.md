# Issue #201 Repository diff backend

Issue: #201

## Acceptance criteria

- [x] Resolve a deterministic base and merge-base.
- [x] Combine committed, staged, unstaged, and untracked changes.
- [x] Generate an rs1 snapshot from HEAD, index, and current content.
- [x] Separate repository paths from Spec document identities.
- [x] Use bounded direct Git processes with typed errors.
- [x] Return typed base, consistency, path, and process states.
- [x] Enforce strict UTF-8 repository-relative paths.
- [x] Bound content, binary probes, patches, and lazy result pages.
- [x] Register three additive Tauri commands.
- [x] Document the IPC and safety contract.
- [x] Test with a self-generated Git repository fixture.
- [x] Pass Rust fmt, clippy with warnings denied, and all-target tests.

## Completion note

Implemented in the current Issue #201 working tree; no implementation commit or PR was
created in this session. Verification includes 314 Rust library tests, 825 frontend
tests, self-generated multi-state and submodule Git fixtures, Clippy with warnings
denied, a production frontend build, and 83.47% total Rust line coverage.
