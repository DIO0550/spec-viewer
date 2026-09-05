# Review Phase 1 regression suite

Issue #199 is tracked by
`src/tests/acceptance/review-phase-1.generated.json`. Every leaf names one behavior, an
exact runner selector, its operating system, CI job, and artifact. A missing or duplicate
target result makes `pnpm test:acceptance:evidence -- <result.json...>` fail.

This suite is the executable evidence for the product and developer contracts linked from
[Specs / Diff integrated review guide](../integrated-review-guide.md) and
[Phase 1 developer contract](../design/integrated-review-contract.md).

## Local commands

Run the commands from `spec-viewer/`.

```bash
pnpm typecheck
pnpm lint
pnpm test:run
pnpm test:e2e:app
pnpm build-storybook
pnpm test:e2e:storybook
xvfb-run -a pnpm test:e2e:native
```

Run one Rust leaf through `pnpm test:acceptance:cargo -- <suffix>`. The resolver first
runs `cargo test -- --list`, requires one fully qualified match, then executes that name
with `--exact`.

For a focused browser check, start Storybook and run the exact Playwright leaf in another
terminal:

```bash
pnpm storybook
pnpm test:e2e:storybook -- --grep 'R199-VIEW-005'
```

Use `pnpm test:e2e:app -- --grep '<leaf id>'` for an app-web fixture and
`pnpm test:run -- --testNamePattern '<leaf id>'` for a Vitest leaf. Do not replace a
manifest leaf with an approximate manual scenario; its exact selector must emit evidence.

## Storybook screen references

The current visual source is `App/ReviewRegression`. The following story IDs are the
stable Phase 1 references and the allowlisted VRT targets in
`src/tests/acceptance/review-vrt-cases.json`.

| Area | Story ID | Required tuple |
| --- | --- | --- |
| Specs hierarchy | `app-reviewregression--specs-hierarchy` | light, 1280x720 |
| Archive | `app-reviewregression--archive` | light, 1280x720 |
| Progress states | `app-reviewregression--progress` | light, 1280x720 |
| Changed tree | `app-reviewregression--changed-tree` | light, 1280x720 |
| All lazy / generated / ignored | `app-reviewregression--all-lazy` | light, 390x844 |
| Unified | `app-reviewregression--unified` | light, 1280x720 |
| Split | `app-reviewregression--split` | dark, 1280x720 |
| Editor | `app-reviewregression--editor` | dark, 390x844 |
| Revision conflict | `app-reviewregression--conflict` | light, 1280x720 |
| Stale anchor | `app-reviewregression--stale` | dark, 1280x720 |
| Review filters | `app-reviewregression--review-filters` | light, 1280x720 |
| Relocation convergence | `app-reviewregression--convergence` | dark, 1280x720 |
| Unmanaged repository | `app-reviewregression--unmanaged` | light, 1280x720 |
| Base resolution error | `app-reviewregression--base-error` | light, 1280x720 |
| Permission denied | `app-reviewregression--read-denied` | light, 1280x720 |
| Deleted active file | `app-reviewregression--deleted-file` | light, 1280x720 |

Component-level interactions live under `Features/Specs`, `Features/Diff`,
`Features/RepositoryDiff`, and `Diff/Comments`. In particular,
`Diff/Comments/StatefulWorkspace` covers stale draft re-anchor and base draft hide /
restore, while `Diff/Comments/ViewerIntegration` covers comment controls in all three
view modes.

## Fixtures and normalization

Real Git fixtures isolate system/global config, credentials, locale, author, committer,
branch, and timestamps. `scripts/normalize-review-fixture.mjs` replaces only typed
absolute paths, repository/worktree IDs, SHAs, snapshot IDs, and timestamps. It preserves
semantic paths, sides, revisions, comment IDs, and referential identity; unknown volatile
fields fail normalization. Golden metadata records the generation command, raw hash, and
normalizer version.

Fixture coverage includes committed / staged / unstaged / untracked, Changed / All,
ignored / generated lazy traversal, `.git` exclusion, rename / delete / binary / large,
unborn / shallow / detached Git states, side-path anchors, Spec v2 / Diff v1 isolation,
canonical revision conflict / overflow, permission and crash recovery.

## Native lifecycle

The required Ubuntu job installs WebKitWebDriver, Xvfb, and tauri-driver, then builds the
real debug binary with the non-default `native-test-control` Cargo feature. Crash cases
use an owner-only control directory and unpredictable nonce. The app atomically writes
`ready-<nonce>.json` at the selected pre/post-replace barrier while the mutation remains
pending. The harness validates nonce, PID, phase, and document hash before terminating
that PID. Release files are teardown-only; all nonce files and fixtures are removed after
restart. Default and release builds exclude the feature.

## Visual evidence

`review-vrt-cases.json` is the required tuple allowlist. Capture emits exactly one
PNG/hash/head record for every `(leafId, storyId, theme, viewport)` tuple. Candidate
execution is read-only. Approval validation must execute only the default-branch
validator and authenticate actor permission, exact body, current head, tuple, image hash,
ready state, and approval round. Self, stale, malformed, or third-round approvals fail.
Main baselines change only after merge.

The PR Storybook Preview workflow also captures the PR and its base commit with the same
tuple allowlist, generates the visual regression HTML report, and publishes it at
`pr-vrt/pr-{number}/` on GitHub Pages. The PR preview comment links to Current, Expected,
Diff, 2up, Slide, Blend, and Toggle views. This report is review evidence; it does not
replace the trusted approval check.

Issue #199 was the one-time bootstrap for the trusted workflow. Issue #200 and later PRs
must use the base-pinned trusted visual approval check; the bootstrap exception must not
be reused.

Artifacts are named `frontend-junit`, `app-playwright`, `storybook-playwright`,
`native-smoke`, `visual-candidate`, and `visual-approval-evidence`, matching the
acceptance manifest.
