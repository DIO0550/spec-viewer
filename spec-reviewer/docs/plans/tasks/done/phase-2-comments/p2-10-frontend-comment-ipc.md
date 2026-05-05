# P2.10 Frontend Comment IPC

## Tasks

- [x] Add typed `listComments` IPC wrapper.
- [x] Add typed `addComment` IPC wrapper.
- [x] Add typed `updateComment` IPC wrapper.
- [x] Add typed `deleteComment` IPC wrapper.
- [x] Normalize command errors for UI display.
- [x] Add test doubles for component tests.

## Done When

- UI code does not call raw `invoke` for comment commands.

## Completion Note

Implemented typed frontend comment IPC wrappers for list/add/update/delete/resolve/reopen/toggle commands, added a typed command bundle plus component-test double, and covered command payloads and normalized comment command errors. Implementation commit: this commit.
