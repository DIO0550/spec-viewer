# RL.6 Loop QA And Documentation

## Tasks

- [ ] Add manual QA guide for the review loop.
- [ ] Document expected Japanese AI-agent instructions.
- [ ] Add fixture review bundles for tests.
- [ ] Verify create review, external edit, completion, archive, and repeat loop in current-workspace mode.
- [ ] Verify create review, external edit, completion, archive, and repeat loop in worktree mode.
- [ ] Update acceptance checklist.
- [ ] Document limitations and follow-up ideas.

## Acceptance Criteria

- A user can complete at least two review loops on the same spec.
- Archived runs remain readable after app restart.
- New review runs do not overwrite archived runs.
- Documentation explains that this flow is provider-independent and filesystem-based.
- Documentation explains that worktree cleanup and merge remain explicit user actions in the first version.
- Documentation uses Japanese-first user-facing terminology.
