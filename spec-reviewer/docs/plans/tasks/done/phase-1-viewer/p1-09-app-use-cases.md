# P1.9 App Use Cases

## Goal

Create application-layer orchestration for workspace loading, spec listing, and Markdown reading.

## Tasks

- [x] Add `load_workspace` use case.
- [x] Add `list_specs` use case.
- [x] Add `read_spec_file` use case.
- [x] Keep use cases independent from Tauri command types.
- [x] Map infrastructure errors to app-level errors.
- [x] Add use case tests with fake adapters where practical.

## Done When

- Presentation commands can call use cases without knowing filesystem details.
- Use cases expose stable app-level result types.

## Completion Note

Implemented app-layer use cases and fake-adapter tests. Commit: this task completion commit.
