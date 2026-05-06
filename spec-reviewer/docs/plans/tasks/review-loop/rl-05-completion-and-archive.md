# RL.5 Completion And Archive

## Tasks

- [ ] Add `list_review_runs` command for active and archived runs.
- [ ] Parse `status.json` and `result.md` summaries.
- [ ] Surface completed, in-progress, malformed, and missing-folder states.
- [ ] Add `archive_review_run` command.
- [ ] Move completed runs from `<spec-folder>/user-review/active/` to `<spec-folder>/user-review/archive/`.
- [ ] Require explicit confirmation before archive.
- [ ] Preserve warnings when archiving source files that changed after export.

## Acceptance Criteria

- Completed review runs can be archived from the UI.
- Archive preserves manifest, comments, context, result, and status files.
- Archive conflicts fail with clear errors.
- Malformed review run folders are reported but not deleted.
