# Review Phase 1 regression suite

Issue #199 is tracked by `src/tests/acceptance/review-phase-1.generated.json`. Every leaf names one behavior, an exact runner selector, its operating system, CI job, and artifact. A missing or duplicate target result makes `pnpm test:acceptance:evidence -- <result.json...>` fail.

## Local commands

```bash
pnpm typecheck
pnpm lint
pnpm test:run
pnpm test:e2e:app
pnpm build-storybook
pnpm test:e2e:storybook
xvfb-run -a pnpm test:e2e:native
```

Run one Rust leaf through `pnpm test:acceptance:cargo -- <suffix>`. The resolver first runs `cargo test -- --list`, requires one fully qualified match, then executes that name with `--exact`.

## Fixtures and normalization

Real Git fixtures isolate system/global config, credentials, locale, author, committer, branch, and timestamps. `scripts/normalize-review-fixture.mjs` replaces only typed absolute paths, repository/worktree IDs, SHAs, snapshot IDs, and timestamps. It preserves semantic paths, sides, revisions, comment IDs, and referential identity; unknown volatile fields fail normalization. Golden metadata records the generation command, raw hash, and normalizer version.

## Native lifecycle

The required Ubuntu job installs WebKitWebDriver, Xvfb, and tauri-driver, then builds the real debug binary with the non-default `native-test-control` Cargo feature. Crash cases use an owner-only control directory and unpredictable nonce. The app atomically writes `ready-<nonce>.json` at the selected pre/post-replace barrier while the mutation remains pending. The harness validates nonce, PID, phase, and document hash before terminating that PID. Release files are teardown-only; all nonce files and fixtures are removed after restart. Default and release builds exclude the feature.

## Visual evidence

`review-vrt-cases.json` is the required tuple allowlist. Capture emits exactly one PNG/hash/head record for every `(leafId, storyId, theme, viewport)` tuple. Candidate execution is read-only. Approval validation must execute only the default-branch validator and authenticate actor permission, exact body, current head, tuple, image hash, ready state, and approval round. Self, stale, malformed, or third-round approvals fail. Main baselines change only after merge.

Issue #199 is the one-time bootstrap that places the trusted workflow and validator on the default branch. GitHub does not start a newly introduced `workflow_run` workflow from PR code, so #199 uses independent review of the read-only candidate artifact, local 16-tuple capture, and workflow/protocol audits; the trusted check becomes required beginning with the next PR and this exception must not be reused.

Artifacts are named `frontend-junit`, `app-playwright`, `storybook-playwright`, `native-smoke`, `visual-candidate`, and `visual-approval-evidence`, matching the acceptance manifest. This document is the testing handoff for Issue #200; it does not broaden product behavior or replace any automated leaf with manual evidence.
