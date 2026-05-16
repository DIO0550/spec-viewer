# RL.6 Loop QA And Documentation

## Tasks

- [x] Add manual QA guide for the review loop.
- [x] Document expected Japanese AI-agent instructions.
- [x] Add fixture review bundles for tests.
- [x] Verify create review, external edit, completion, archive, and repeat loop in current-workspace mode.
- [x] Verify create review, external edit, completion, archive, and repeat loop in worktree mode.
- [x] Update acceptance checklist.
- [x] Document limitations and follow-up ideas.

## Acceptance Criteria

- A user can complete at least two review loops on the same spec.
- Archived runs remain readable after app restart.
- New review runs do not overwrite archived runs.
- Documentation explains that this flow is provider-independent and filesystem-based.
- Documentation explains that worktree cleanup and merge remain explicit user actions in the first version.
- Documentation uses Japanese-first user-facing terminology.

## Completion Note

Implemented on main in the RL.6 completion commit. Added the review-loop manual QA guide, Japanese-first external AI-agent instructions, current-workspace and worktree repeat-loop QA notes, review-loop acceptance checklist entries, fixture review bundles, and fixture-backed Rust schema tests. Worktree cleanup and merge remain documented as explicit user actions.
