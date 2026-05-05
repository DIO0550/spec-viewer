# P1.2 Workspace Domain

## Goal

Represent supported workspace layouts without leaking filesystem or Tauri details into the domain layer.

## Tasks

- [ ] Add `WorkspaceRoot` value object.
- [ ] Add `WorkspaceKind` enum for `PluginWorkspace` and `SpecSkill`.
- [ ] Add `WorkspaceLayout` domain type.
- [ ] Add validation for supported workspace layouts.
- [ ] Add domain error variants for missing root and unsupported layout.

## Done When

- Domain types are independent from Tauri command DTOs.
- Unit tests cover valid and invalid workspace roots.

