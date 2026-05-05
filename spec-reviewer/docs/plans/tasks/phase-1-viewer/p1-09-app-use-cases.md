# P1.9 App Use Cases

## Goal

Create application-layer orchestration for workspace loading, spec listing, and Markdown reading.

## Tasks

- [ ] Add `load_workspace` use case.
- [ ] Add `list_specs` use case.
- [ ] Add `read_spec_file` use case.
- [ ] Keep use cases independent from Tauri command types.
- [ ] Map infrastructure errors to app-level errors.
- [ ] Add use case tests with fake adapters where practical.

## Done When

- Presentation commands can call use cases without knowing filesystem details.
- Use cases expose stable app-level result types.

