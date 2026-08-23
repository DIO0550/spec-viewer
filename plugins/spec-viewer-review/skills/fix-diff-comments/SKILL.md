---
name: fix-diff-comments
description: Fix unresolved code review comments created on a repository diff in spec-viewer. Use when the user asks to apply, address, or repair spec-viewer diff comments; do not use for GitHub PR review threads or planning-document comments.
argument-hint: "[comment-id ...]"
---

# Fix Diff Comments

Apply valid, unresolved spec-viewer Diff comments to the current working tree while preserving unrelated user changes.

## Comment store

Repository Diff comments are stored under the canonical Git common directory:

```text
<git-common-dir>/spec-viewer/diff-comments/df1_*.v1.json
```

Resolve `<git-common-dir>` with `git rev-parse --git-common-dir`, then inspect the matching JSON files. Do not edit them.

Each document has this shape:

```json
{
  "version": 1,
  "repositoryId": "rr1_...",
  "worktreeId": "rw1_...",
  "revision": "25",
  "comments": [
    {
      "id": "comment-id",
      "body": "Requested correction",
      "resolved": false,
      "createdAt": "2026-08-23T00:00:00Z",
      "replies": [
        {
          "id": "reply-id",
          "body": "Clarification",
          "createdAt": "2026-08-23T00:01:00Z"
        }
      ],
      "anchor": {
        "repositoryId": "rr1_...",
        "worktreeId": "rw1_...",
        "baseSha": "commit SHA",
        "currentSnapshotId": "snapshot ID",
        "side": "current",
        "oldPath": "previous/path.ts",
        "newPath": "current/path.ts",
        "line": 12,
        "endLine": 14,
        "lineHash": "sha256:...",
        "snippet": "anchored source line",
        "contextBefore": ["preceding line"],
        "contextAfter": ["following line"]
      }
    }
  ]
}
```

`oldPath`, `newPath`, `endLine`, and `replies` can be absent when not applicable.

## Load the review

1. Read the repository instructions that govern the target files, including `AGENTS.md` or `CLAUDE.md` files. Invoke any language or workflow skills they require before editing.
2. Inspect `git status --short`, the unstaged Diff, and the staged Diff. Preserve all pre-existing changes.
3. Find the comment documents in the store above and read comments with `resolved: false`. If no document or unresolved comment exists, report that and stop.
4. When multiple worktree documents contain unresolved comments, compare their anchor paths with the current repository. If more than one remains plausible, present their `worktreeId` and paths and ask the user which review to apply; do not guess.
5. If `$ARGUMENTS` contains comment IDs, handle only those IDs and report requested IDs that are absent or already resolved. Otherwise handle every unresolved comment in the selected document.

## Evaluate each comment

Use `body` as the requested change. Treat `replies` as chronological clarification; a later reply can narrow or supersede the original request.

Resolve the editable path as follows:

- `anchor.side: "current"`: use `newPath`.
- `anchor.side: "base"`: use `newPath` when present, otherwise `oldPath`. Modify the current working tree, never the base commit.

The recorded line range belongs to the snapshot at comment creation and may be stale. Locate the target by combining `snippet`, `contextBefore`, `contextAfter`, the path, and the current Diff. Do not guess when multiple locations are plausible.

Before editing, classify each comment:

- **Apply**: the issue exists and the requested outcome is sound.
- **Already addressed**: the current code already satisfies it.
- **Skip**: it is incorrect, conflicts with repository requirements or another comment, targets unavailable content, or cannot be anchored confidently.

Explain skipped comments with concrete evidence.

## Implement and verify

Make the smallest coherent change for each applicable comment. Group overlapping comments so one edit does not undo another. Update tests when behavior changes, and run the narrowest relevant checks required by the repository instructions.

Do not edit the `spec-viewer/diff-comments/` store, change `resolved`, or rewrite `revision`. spec-viewer owns that state. Do not commit, push, post replies, or resolve comments in another system unless the user separately requests those actions.

## Report

Report one result per requested comment:

```text
- <comment-id> <path>:<line> — fixed | already addressed | skipped: <concise result>
```

Then list verification commands and outcomes, mention remaining comments, and ask the user to inspect the changes and resolve satisfied comments in spec-viewer.
