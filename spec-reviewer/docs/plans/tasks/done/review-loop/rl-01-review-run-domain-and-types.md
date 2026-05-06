# RL.1 Review Run Domain And Types

## Tasks

- [x] Define user review run ID, status, target, source file, spec folder, and manifest domain types.
- [x] Define execution target types for current workspace and Git worktree modes.
- [x] Define valid status transitions: active, inProgress, completed, archived.
- [x] Add frontend `ReviewRun` request/response types.
- [x] Define `manifest.json`, `status.json`, and bundle schema versions.
- [x] Add path validation rules for `user-review/active/` and `user-review/archive/` under the target spec folder.

## Acceptance Criteria

- User review run models do not depend on Tauri types.
- Invalid IDs and path traversal inputs are rejected.
- File and spec targets can be represented for the first version.
- Manifest schema can represent both current-workspace and worktree execution targets.
- TypeScript and Rust tests cover status and schema basics.

## Completion Note

Implemented on main in the task completion commit. Added Rust review-run domain models, manifest/status schema DTOs, active/archive path validation, TypeScript review-run DTOs, and Rust/TypeScript coverage for the new schema and status basics.
