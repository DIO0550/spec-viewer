# P4.6 Config Overrides

## Tasks

- [x] Define override file location.
- [x] Add domain type for spec-level overrides.
- [x] Merge workspace defaults, workspace config, and spec override config.
- [x] Add validation errors for invalid overrides.
- [x] Show override source in debug UI or logs.
- [x] Add fixture tests.

## Completion Note

Implemented spec-level config overrides loaded from `<spec-folder>/.spec-reviewer/config.json`, merged after workspace defaults and workspace config. Added validation errors for malformed or unsafe override mappings, propagated override config source metadata through backend DTOs and tab debug affordances, and covered domain, persistence, scanner, and read-use-case behavior with fixture-style tests.

Implementation commit: `9c94480`.
