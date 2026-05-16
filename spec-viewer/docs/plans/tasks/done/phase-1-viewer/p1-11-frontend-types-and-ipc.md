# P1.11 Frontend Types And IPC

## Goal

Create typed frontend wrappers around Tauri commands.

## Tasks

- [x] Add `src/types/workspace.ts`.
- [x] Add `src/types/spec.ts`.
- [x] Add `src/types/ipc.ts`.
- [x] Add `src/lib/tauri.ts` wrapper around `invoke`.
- [x] Add typed `loadWorkspace`.
- [x] Add typed `listSpecs`.
- [x] Add typed `readSpecFile`.
- [x] Add error normalization for command failures.

## Done When

- Components and hooks do not call raw `invoke` directly.
- TypeScript catches command payload mismatches.

## Completion Note

Implemented frontend shared workspace/spec/IPC types, typed Tauri command wrappers for the Phase 1 backend commands, command failure normalization, and removed the starter raw `invoke` usage from `App`.

Implementation commit: `f3bb1a3`.
