# Phase 2 tasks: comments

## Goal

Allow users to create, view, update, resolve, and delete comments without modifying source Markdown files.

## Rust Tasks

- [ ] Add `comment/mod.rs`.
- [ ] Add `comment/store.rs`.
- [ ] Define `Comment`, `CommentAnchor`, and update payload structs.
- [ ] Store comments as JSON arrays under `.comments/<logical-file>.json`.
- [ ] Create `.comments/` directories on first write.
- [ ] Preserve unknown existing files in `.comments/`.
- [ ] Implement atomic-ish write flow using temp file then rename where practical.
- [ ] Expose `list_comments(workspace_path, feature_id, file_key)`.
- [ ] Expose `add_comment(workspace_path, feature_id, file_key, input)`.
- [ ] Expose `update_comment(workspace_path, feature_id, file_key, id, patch)`.
- [ ] Expose `delete_comment(workspace_path, feature_id, file_key, id)`.

## TypeScript Tasks

- [ ] Add `src/types/comment.ts`.
- [ ] Add `src/hooks/useComments.ts`.
- [ ] Add `CommentSidebar` component.
- [ ] Add `CommentThread` component.
- [ ] Add resolved/unresolved visual states.
- [ ] Add delete confirmation UI.
- [ ] Add optimistic UI for add/update/resolve, with rollback on IPC failure.

## UI Behavior

- [ ] Comments for the current feature and tab load when the tab changes.
- [ ] Sidebar shows open comments first.
- [ ] Resolved comments remain visible but visually subdued.
- [ ] Clicking a comment attempts to scroll to its anchor.
- [ ] Deleting a comment removes it from the JSON store, not from Markdown.

## Tests

- [ ] Rust unit tests for reading missing comment files as empty arrays.
- [ ] Rust unit tests for add/update/delete persistence.
- [ ] Rust unit tests for invalid IDs.
- [ ] React tests for sidebar rendering.
- [ ] React tests for resolve toggling.

## Detailed Task Breakdown

### P2.1 Comment Domain Skeleton

- [ ] Create `src-tauri/src/domain/comment/mod.rs`.
- [ ] Add `CommentId` value object.
- [ ] Add `CommentBody` value object.
- [ ] Add `CommentStatus` enum.
- [ ] Add `Comment` entity.
- [ ] Add `CommentThread` domain type if multiple replies are supported.
- [ ] Add comment domain errors.

### P2.2 Anchor Domain

- [ ] Add `CommentAnchor` domain type.
- [ ] Add `BlockType` enum.
- [ ] Add `BlockIndex` value object.
- [ ] Add `TextHash` value object.
- [ ] Add `TextSnippet` value object.
- [ ] Add `CharRange` value object.
- [ ] Validate char range start/end ordering.

### P2.3 Comment Repository Contract

- [ ] Define repository trait for comment persistence behavior.
- [ ] Add `list` method signature.
- [ ] Add `add` method signature.
- [ ] Add `update` method signature.
- [ ] Add `delete` method signature.
- [ ] Add `replace_all` only if needed for resolution updates.
- [ ] Keep storage path details out of the trait API.

### P2.4 JSON Persistence Format

- [ ] Define persistence DTOs for comment JSON.
- [ ] Choose JSON array or wrapper object and document the choice.
- [ ] Preserve stable field names: `id`, `anchor`, `body`, `status`, `createdAt`, `updatedAt`.
- [ ] Decide whether timestamps are generated in Rust only.
- [ ] Add serde round-trip tests.
- [ ] Add malformed JSON tests.

### P2.5 Comment Storage Paths

- [ ] Resolve `.comments/<logical-file>.json` for `.plugin-workspace` specs.
- [ ] Ensure comment storage stays inside the selected spec folder.
- [ ] Create `.comments/` on first write.
- [ ] Read missing comment file as an empty list.
- [ ] Preserve unknown files in `.comments/`.

### P2.6 Comment Store Implementation

- [ ] Implement JSON read.
- [ ] Implement JSON write.
- [ ] Implement temp-file then rename write flow.
- [ ] Implement duplicate ID guard.
- [ ] Implement update by ID.
- [ ] Implement delete by ID.
- [ ] Return typed errors for malformed JSON.
- [ ] Return typed errors for missing comment IDs.

### P2.7 Comment Use Cases

- [ ] Add `list_comments` use case.
- [ ] Add `add_comment` use case.
- [ ] Add `update_comment` use case.
- [ ] Add `delete_comment` use case.
- [ ] Add explicit `resolve_comment` and `reopen_comment` commands.
- [ ] Generate IDs in the application layer.
- [ ] Generate timestamps in the application layer.
- [ ] Validate body is non-empty before persistence.

### P2.8 Comment Commands

- [ ] Add `presentation/commands/comments.rs`.
- [ ] Add request DTO for listing comments.
- [ ] Add request DTO for adding a comment.
- [ ] Add request DTO for patching a comment.
- [ ] Add request DTO for deleting a comment.
- [ ] Add response DTO for comments.
- [ ] Register comment commands in `lib.rs`.
- [ ] Keep command DTOs separate from domain entities.

### P2.9 Frontend Comment Types

- [ ] Add `src/types/comment.ts`.
- [ ] Add `CommentAnchor` type.
- [ ] Add a closed `open | resolved` status type.
- [ ] Add command input/output types.
- [ ] Add UI view model for resolved/orphaned display state.

### P2.10 Frontend Comment IPC

- [ ] Add typed `listComments` IPC wrapper.
- [ ] Add typed `addComment` IPC wrapper.
- [ ] Add typed `updateComment` IPC wrapper.
- [ ] Add typed `deleteComment` IPC wrapper.
- [ ] Normalize command errors for UI display.
- [ ] Add test doubles for component tests.

### P2.11 Comment State Hook

- [ ] Add `src/hooks/useComments.ts`.
- [ ] Load comments when selected workspace/spec/file changes.
- [ ] Track loading state.
- [ ] Track save/update/delete state.
- [ ] Track command errors.
- [ ] Add optimistic updates for explicit resolve and reopen operations.
- [ ] Roll back optimistic update on failure.
- [ ] Refetch after destructive operations if needed.

### P2.12 Sidebar UI

- [ ] Add `CommentSidebar` component.
- [ ] Add open section.
- [ ] Add resolved section.
- [ ] Add empty state for no comments.
- [ ] Add count badges.
- [ ] Add compact comment item component.
- [ ] Add timestamp display.
- [ ] Add active comment highlight state.

### P2.13 Comment Thread UI

- [ ] Add `CommentThread` component.
- [ ] Add body display.
- [ ] Add edit mode.
- [ ] Add save/cancel actions.
- [ ] Add resolve/unresolve action.
- [ ] Add delete action.
- [ ] Add delete confirmation.
- [ ] Add validation message for empty body.

### P2.14 Text Selection Flow

- [ ] Detect text selection inside `MarkdownViewer`.
- [ ] Ignore selections outside Markdown content.
- [ ] Compute selected block metadata.
- [ ] Compute selected text snippet.
- [ ] Compute char range within block where practical.
- [ ] Show floating add-comment button.
- [ ] Hide button when selection clears.
- [ ] Keep selection state stable while opening comment popover.

### P2.15 Add Comment UI

- [ ] Add comment popover component.
- [ ] Add textarea.
- [ ] Add submit/cancel buttons.
- [ ] Disable submit for empty body.
- [ ] Submit with anchor payload.
- [ ] Clear selection after successful add.
- [ ] Show error state on failed add.

### P2.16 Highlight Display

- [ ] Highlight blocks with comments.
- [ ] Use different style for active comment.
- [ ] Use different style for resolved comments.
- [ ] Clicking a highlight selects the comment.
- [ ] Keep highlight styles readable in Markdown.
- [ ] Avoid shifting Markdown layout when highlights appear.
