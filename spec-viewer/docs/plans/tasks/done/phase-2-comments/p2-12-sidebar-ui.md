# P2.12 Sidebar UI

## Tasks

- [x] Add `CommentSidebar` component.
- [x] Add unresolved section.
- [x] Add resolved section.
- [x] Add empty state for no comments.
- [x] Add count badges.
- [x] Add compact comment item component.
- [x] Add timestamp display.
- [x] Add active comment highlight state.

## Done When

- Users can scan comments for the active spec file from the right sidebar.

## Completion Note

Implemented the right-side `CommentSidebar` for the selected spec file with loading, error, empty, open, and resolved states; count badges; compact comment previews; timestamps; active selection highlighting; and resolve/reopen/delete actions wired through `useComments`. App shell now receives the sidebar as a composed pane. Implementation commit: this commit.
