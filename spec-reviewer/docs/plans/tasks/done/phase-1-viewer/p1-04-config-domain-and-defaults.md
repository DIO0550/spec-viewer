# P1.4 Config Domain And Defaults

## Goal

Provide configurable logical file mappings with safe defaults for each supported workspace kind.

## Tasks

- [x] Add `WorkspaceConfig` domain type.
- [x] Add default config for `.plugin-workspace/.specs/`.
- [x] Add default config for `.spec-skill/features/`.
- [x] Add merge behavior for user config over defaults.
- [x] Add validation for duplicate logical file keys.
- [x] Add validation for unsafe file names or parent path traversal.

## Done When

- Missing config still gives useful tabs.
- Invalid mappings return typed errors.

## Completion Note

Completed in implementation commit `f67a293`. Added domain-only workspace config defaults, merge behavior, and typed validation for duplicate logical keys and unsafe file names. Verified with `cargo fmt` and `cargo test`.
