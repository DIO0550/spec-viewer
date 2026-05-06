# RL.5 Completion And Archive

## Tasks

- [x] Add `list_review_runs` command for active and archived runs.
- [x] Parse `status.json` and `result.md` summaries.
- [x] Surface completed, in-progress, malformed, and missing-folder states.
- [x] Add `archive_review_run` command.
- [x] Move completed runs from `<spec-folder>/user-review/active/` to `<spec-folder>/user-review/archive/`.
- [x] Require explicit confirmation before archive.
- [x] Preserve warnings when archiving source files that changed after export.

## Acceptance Criteria

- Completed review runs can be archived from the UI.
- Archive preserves manifest, comments, context, result, and status files.
- Archive conflicts fail with clear errors.
- Malformed review run folders are reported but not deleted.

## Completion Note

Implemented on main in the RL.5 completion commit. Added status/result parsing for listed review runs, malformed/missing-folder problem reporting, completed-run archive movement with manifest/status updates and warning preservation, and a confirmed archive action in the review run panel.
