# P1.4 Config Domain And Defaults

## Goal

Provide configurable logical file mappings with safe defaults for each supported workspace kind.

## Tasks

- [ ] Add `WorkspaceConfig` domain type.
- [ ] Add default config for `.plugin-workspace/.specs/`.
- [ ] Add default config for `.spec-skill/features/`.
- [ ] Add merge behavior for user config over defaults.
- [ ] Add validation for duplicate logical file keys.
- [ ] Add validation for unsafe file names or parent path traversal.

## Done When

- Missing config still gives useful tabs.
- Invalid mappings return typed errors.

