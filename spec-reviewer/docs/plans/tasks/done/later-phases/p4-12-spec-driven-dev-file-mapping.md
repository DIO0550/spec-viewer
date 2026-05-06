# P4.12 Spec-driven-dev File Mapping

## Tasks

- [x] Update plugin-workspace default file names:
  - `exploration` -> `exploration-report.md`
  - `hearing` -> `hearing-notes.md`
  - `impl` -> `implementation-plan.md`
  - `tasks` -> `tasks.md`
- [x] Update the default mapping in `src-tauri/src/domain/workspace/config.rs`.
- [x] Update config loading tests and fixtures in `src-tauri/src/infrastructure/persistence/config.rs`.
- [x] Update spec scanning and command tests that still construct plugin-workspace files with old names.
- [x] Keep `.spec-skill` compatibility defaults unchanged:
  - `requirements` -> `requirements.md`
  - `design` -> `design.md`
  - `tasks` -> `tasks.md`
- [x] Update Rust unit tests that still expect `exploration.md`, `hearing.md`, or `impl.md`.
- [x] Update frontend fixtures/stories if they show old plugin-workspace filenames.
- [x] Add or update coverage using a fixture shaped like `.plugin-workspace/.specs/021-issue-262/`.
- [x] Verify comments and user-review source file paths use the actual mapped Markdown filenames.
- [x] Run the Rust tests that cover workspace config, spec scanning, markdown reads, and review-run manifest paths.

## Implementation Targets

Use `.plugin-workspace/.specs/021-issue-262/` as the source of truth:

```text
.plugin-workspace/.specs/021-issue-262/
├── hearing-notes.md
├── exploration-report.md
├── implementation-plan.md
├── tasks.md
├── plan-review/
└── code-review/
```

Known stale references to check and update where they represent plugin-workspace defaults:

| Area | Current stale assumption | Required behavior |
| --- | --- | --- |
| `domain/workspace/config.rs` | `exploration.md`, `hearing.md`, `impl.md` | `exploration-report.md`, `hearing-notes.md`, `implementation-plan.md` |
| `infrastructure/persistence/config.rs` tests | default plugin mapping uses old names | tests expect actual spec-driven-dev filenames |
| spec scanning tests | plugin-workspace fixture may write old names | fixture uses actual `021-issue-262` shape |
| review-run manifest tests | may use `requirements.md` for plugin-workspace examples | plugin-workspace examples use `implementation-plan.md` for `impl` |
| frontend fixtures/stories | examples may mix `.spec-skill` and plugin-workspace names | plugin-workspace examples show `implementation-plan.md` |

Do not change comment storage file names such as `.comments/impl.json`; those are logical-key based and are separate from source Markdown filenames.

## Acceptance Criteria

- A spec-driven-dev folder containing `hearing-notes.md`, `exploration-report.md`, `implementation-plan.md`, and `tasks.md` loads without any config override.
- The visible logical tabs can remain `Exploration`, `Hearing`, `Implementation`, and `Tasks`.
- Review run manifests use actual source file paths such as `implementation-plan.md`, not `impl.md` or `requirements.md`.
- `.spec-skill` compatibility workspaces are unaffected.

## Notes

- The logical key `impl` is still useful internally; only its default filename is wrong for spec-driven-dev output.
- Use `.plugin-workspace/.specs/021-issue-262/` as the concrete structure check.

## Completion Note

Completed in implementation commit `509815152380d3f16a9a8c5205328f2cbc985232`.
