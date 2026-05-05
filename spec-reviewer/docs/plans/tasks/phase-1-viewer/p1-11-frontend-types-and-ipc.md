# P1.11 Frontend Types And IPC

## Goal

Create typed frontend wrappers around Tauri commands.

## Tasks

- [ ] Add `src/types/workspace.ts`.
- [ ] Add `src/types/spec.ts`.
- [ ] Add `src/types/ipc.ts`.
- [ ] Add `src/lib/tauri.ts` wrapper around `invoke`.
- [ ] Add typed `loadWorkspace`.
- [ ] Add typed `listSpecs`.
- [ ] Add typed `readSpecFile`.
- [ ] Add error normalization for command failures.

## Done When

- Components and hooks do not call raw `invoke` directly.
- TypeScript catches command payload mismatches.

