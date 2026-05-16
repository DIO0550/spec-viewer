# P4.13 Saved Workspace Switcher

## Goal

Make opened workspaces durable and easy to switch. After a user successfully opens a workspace once, the app should save it and let the user switch to it from the app UI without reopening the folder picker.

This extends the completed P4.5 recent-workspaces behavior. P4.5 records recent paths; P4.13 turns that into a first-class saved workspace switcher for day-to-day use.

## Tasks

- [x] Save every successfully opened workspace automatically.
- [x] Save workspaces opened through the folder picker and drag-and-drop flow.
- [x] Store at least workspace path, display name, workspace kind, and last opened timestamp.
- [x] Persist the last active workspace separately from the saved workspace list.
- [x] Restore the last active workspace on app startup when it still exists and validates.
- [x] Add a Japanese workspace switcher in the toolbar.
- [x] Show saved workspaces with a readable name and full path hint.
- [x] Let users switch workspaces with one click from the saved list.
- [x] Keep the current workspace loaded if switching to a saved workspace fails.
- [x] Show a Japanese error when a saved workspace no longer exists or is no longer supported.
- [x] Let users remove a saved workspace from the list.
- [x] Keep a clear action for all saved workspaces.
- [x] Dedupe saved workspaces by normalized path and update metadata on reopen.
- [x] Preserve selected spec/file reset behavior when switching workspaces.
- [x] Add tests for auto-save, startup restore, switch success, switch failure, remove, clear, and dedupe.

## UI Copy

Suggested Japanese labels:

| Concept | Label |
| --- | --- |
| Workspace switcher | ワークスペース |
| Open workspace | ワークスペースを開く |
| Saved workspaces | 保存済みワークスペース |
| Current workspace | 現在のワークスペース |
| Remove workspace | 一覧から削除 |
| Clear saved workspaces | 保存済みをすべて削除 |
| Missing workspace | ワークスペースが見つかりません |
| Unsupported workspace | 対応していないワークスペースです |

## Acceptance Criteria

- Opening a valid `.plugin-workspace/.specs/` workspace saves it automatically.
- Opening a valid `.spec-skill/` compatibility workspace saves it automatically.
- Restarting the app restores the last active valid workspace without asking the user to choose a folder again.
- The toolbar switcher lists saved workspaces and can switch between them without using the OS folder picker.
- Failed switching does not unload the current workspace.
- Users can remove one saved workspace or clear the full saved list.

## Notes

- The existing localStorage-backed recent workspace implementation can be reused if it is still the simplest persistence layer.
- The saved list should be path-based, not spec-based. Spec/file selection may remain session-level unless a later task explicitly adds per-workspace selection restore.
- Do not create or modify files inside the reviewed workspace for this preference state.

## Completion Note

Implemented saved workspace metadata persistence, separate last-active restore, toolbar/empty-state switcher UI, failed-switch preservation, and storage/hook/component coverage in commit `4e39a0329194b31b55d145965b2966c714da7b19`.
