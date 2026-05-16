# P1.6 Infrastructure: Config Loading

## Goal

Load optional config JSON and merge it with workspace-kind defaults.

## Tasks

- [x] Define expected config file locations for each workspace kind.
- [x] Read config JSON if present.
- [x] Fall back to workspace-kind defaults when absent.
- [x] Return typed config errors for malformed JSON.
- [x] Return typed config errors for invalid file mappings.
- [x] Add tests for missing, valid, malformed, and partial configs.

## Done When

- Config loading never panics on missing or malformed config.
- Tests document the precedence rules.

## Completion Note

Implemented workspace config loading in persistence infrastructure with workspace-kind config locations, default fallback, JSON parsing, domain validation reuse, and file I/O tests. Verified with `cargo fmt` and `cargo test`. Implementation commit: `512fbe6`.
