# P1.6 Infrastructure: Config Loading

## Goal

Load optional config JSON and merge it with workspace-kind defaults.

## Tasks

- [ ] Define expected config file locations for each workspace kind.
- [ ] Read config JSON if present.
- [ ] Fall back to workspace-kind defaults when absent.
- [ ] Return typed config errors for malformed JSON.
- [ ] Return typed config errors for invalid file mappings.
- [ ] Add tests for missing, valid, malformed, and partial configs.

## Done When

- Config loading never panics on missing or malformed config.
- Tests document the precedence rules.

