# Repository Diff comments

Repository Diff comments are worktree-wide review notes anchored to one real text line in a specific base/current snapshot. They are separate from Spec comments and do not change Spec export, MCP, LLM, or JSON v2 behavior.

## Commentable lines

- Unified: removed lines use the base side, added lines use current, and unchanged context exposes both sides.
- Split: each real base/current cell is independent. Spacer cells are never targets.
- Editor: every real current line is commentable, including unchanged lines shown by All. Deleted/previous peek summaries, peek rows, annotations, gaps, binary files, omitted files, and synthetic rows are not targets.
- Phase 1 allows one comment per semantic line and has no replies or delete action. Resolve, reopen, and body updates are supported.

An existing open or resolved comment replaces the `+` with an indicator, so a second comment cannot be created at that location. If historical comments relocate to the same line, the count opens a deterministic created-at/ID picker.

## Keyboard workflow

Focus a line `+` and activate it to open the inline composer. The textarea receives focus immediately.

- Enter inserts a newline.
- Ctrl+Enter or Cmd+Enter submits a non-empty draft.
- Esc cancels without bubbling to workspace shortcuts and restores focus to the originating `+`.
- IME composition Enter/Esc is ignored until composition ends.

Only one composer is active in a repository workspace. Switching tabs or modes keeps the controlled draft. A base draft is hidden in Editor and returns in Unified/Split; changing snapshot/worktree marks an unsent draft stale until it is re-anchored or discarded.


The composer remains editable when a target is stale or the document revision has overflowed, but button and keyboard submission are disabled. Permission/invalid-store failures block every create, body update, resolve, reopen, and re-anchor mutation for that repository/worktree document; cancelling or opening a new draft cannot bypass the block. The retained body remains copyable, transient failures expose retry, and an uncertain durability result asks the reviewer to reload before repeating a mutation.
## Review panel and navigation

Review is visible in Repository Diff mode and is controlled by Open, Resolved, All, and search state. Activating a line indicator forces All, clears search, selects the card, and keeps the draft. Selecting a card alone preserves filters; “行へ移動” opens `selectionPath`, uses `sidePath` for the semantic anchor, materializes the windowed line, and focuses its indicator/control. A base jump from Editor switches to Unified.

Resolution labels mean:

- `exact`: the immutable anchor still matches its original line.
- `relocated`: the unique content/context match moved; the runtime target is safe to jump to.
- `stale`: no unique safe target exists (for example delete, rename ambiguity, missing context, binary, or snapshot change). The original location remains visible and jump is disabled.
- `unavailable`: IO, permission, budget, cancellation, or repository-change prevented resolution. The card remains visible, a warning is shown, and jump is disabled.

No stale or unavailable result silently guesses a line.

## Storage and schema

Diff comments use a separate version-1 JSON document under the repository Git common directory. The physical filename is derived from the canonical worktree storage identity; it is not a raw repository path. The document scope stores repository/worktree identity and a decimal u64 revision. Each immutable anchor stores the historical repository/worktree/base/current identity together with both old and new paths, side, line hash, snippet, and context. Comment records also store body, resolved flag, and RFC3339 creation time. Runtime resolution and warning fields are returned by commands but are not persisted.

Spec comments and Diff comments share the accessible `ReviewComment` card presentation for selection, body editing, resolve/reopen, search highlighting, and keyboard focus. Their domain models and persistence remain separate; the Spec adapter retains delete and anchor-specific behavior, while the Diff adapter adds line jump and runtime resolution state. The Diff Review list materializes at most 100 cards from up to 10,000 loaded comments and always includes the selected card.

Every create/update supplies the expected document revision. The backend holds a cross-process lock, validates the exact four-part identity and target, writes a private temporary file, syncs it, atomically replaces the document, then reports durable/uncertain directory sync status. Separate worktrees never share a document.

## Recovery

- CAS conflict: the latest document/revision is loaded and the textarea draft is retained; review the new state and submit again.
- Transient IO/store-busy/transport failure: the draft remains available for retry.
- Permission or invalid-store failure: copy the retained body, correct repository permissions/store data, then reload. A failed reload keeps the document blocked; only a successful validated reload clears it.
- Revision overflow: every mutation is disabled permanently for that document; a successful reload still derives the block from the maximum stored revision. The body remains selectable/copyable.
- Durability uncertain: the committed comment is shown with a warning; reload before repeating the operation.
- Refresh/reload: committed comments reload for the same repository/worktree/base/snapshot identity. Another identity starts an isolated session.

The stored file should not be edited while the app is running. If manual recovery is necessary, back it up first and preserve strict JSON version 1, canonical decimal revision, and the complete identity.
