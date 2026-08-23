---
name: fix-diff-comments
description: Fix unresolved code review comments created on a repository diff in spec-viewer. Use when the user asks to apply, address, or repair spec-viewer diff comments; do not use for GitHub PR review threads or planning-document comments.
argument-hint: "[comment-id ...]"
---

# Fix Diff Comments

Apply valid, unresolved spec-viewer Diff comments to the current working tree while preserving unrelated user changes.

## Load the review

1. Read the repository instructions that govern the target files, including `AGENTS.md` or `CLAUDE.md` files. If those instructions require other skills for the affected language or workflow, invoke them before editing.
2. Inspect `git status --short`, the unstaged Diff, and the staged Diff. Treat every pre-existing change as user-owned and do not discard, overwrite, stage, or commit it.
3. Load the current worktree's unresolved comments:

   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/scripts/list_diff_comments.py" --project-dir "${CLAUDE_PROJECT_DIR}"
   ```

   The script is read-only. It returns `status: "not_found"` when spec-viewer has not created a Diff comment document for this worktree. Report that state and stop. If `openCount` is zero, report that there are no unresolved comments and stop.
4. If `$ARGUMENTS` contains comment IDs, handle only those IDs and report any requested ID that is absent or already resolved. Otherwise handle every comment returned by the script.

## Evaluate each comment

Use the comment body as the requested change. Treat replies as chronological clarification; a later reply can narrow or supersede the original request.

Resolve the editable path as follows:

- `current` anchor: use `newPath`.
- `base` anchor: use `newPath` when present, otherwise `oldPath`. A base anchor describes historical content; make the correction in the current working tree, never in the base commit.

Anchor line numbers describe the snapshot at comment creation and may be stale. Locate the target by combining `snippet`, `contextBefore`, `contextAfter`, the recorded path, and the current Diff. Do not guess when multiple locations are plausible.

Before editing, compare the instruction with the current implementation and classify the comment:

- **Apply**: the issue is present and the requested outcome is sound.
- **Already addressed**: the current code already satisfies it.
- **Skip**: the request is incorrect, conflicts with repository requirements, conflicts with another comment, targets unavailable content, or cannot be anchored confidently.

Explain skipped comments with concrete evidence. Do not make speculative changes merely to satisfy comment wording.

## Implement and verify

Make the smallest coherent change that addresses each applicable comment. Group overlapping comments so one edit does not undo another. Update tests when behavior changes, and run the narrowest relevant tests plus required lint, type-check, or build commands from the repository instructions. If a check cannot run, report the reason rather than claiming success.

Do not edit files under the Git common directory's `spec-viewer/diff-comments/` store, change a comment's `resolved` flag, or rewrite its revision. spec-viewer owns that concurrent state. Do not commit, push, post replies, or resolve comments in another system unless the user separately requests those actions.

## Report

Report one result per requested comment:

```text
- <comment-id> <path>:<line> — fixed | already addressed | skipped: <concise result>
```

Then list verification commands and their outcomes, mention any remaining comments, and ask the user to inspect the changes and resolve satisfied comments in spec-viewer.
