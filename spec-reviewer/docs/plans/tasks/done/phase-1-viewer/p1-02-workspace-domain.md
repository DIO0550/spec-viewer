# P1.2 Workspace Domain

## Goal

Represent supported workspace layouts without leaking filesystem or Tauri details into the domain layer.

## Tasks

- [x] Add `WorkspaceRoot` value object.
- [x] Add `WorkspaceKind` enum for `PluginWorkspace` and `SpecSkill`.
- [x] Add `WorkspaceLayout` domain type.
- [x] Add validation for supported workspace layouts.
- [x] Add domain error variants for missing root and unsupported layout.

## Done When

- Domain types are independent from Tauri command DTOs.
- Unit tests cover valid and invalid workspace roots.

## Completion Note

Implemented workspace domain value objects, supported layout kinds, typed errors, and unit tests.
Commit: e065d5c2cfc2d3e6d7142325dc0d4e8faed3a907.
