# AGENTS.md

## Scope

This repository contains the `spec-viewer` Tauri application and supporting planning documents. Keep new implementation work inside `spec-viewer/` unless the change is clearly about repository tooling or the dev container.

## Repository Structure

```text
.
├── AGENTS.md
├── README.md
├── spec-viewer-plan.md
├── md-viewer-app Design.html
├── .devcontainer/
└── spec-viewer/
    ├── docs/
    │   ├── design/
    │   └── plans/
    ├── src/
    │   ├── components/
    │   ├── hooks/
    │   ├── lib/
    │   ├── styles/
    │   └── types/
    ├── src-tauri/
    │   └── src/
    │       ├── app/
    │       ├── domain/
    │       ├── infrastructure/
    │       ├── presentation/
    │       ├── lib.rs
    │       └── main.rs
    ├── .storybook/
    ├── package.json
    └── vite.config.ts
```

## Frontend File Placement

- Put reusable React UI in `spec-viewer/src/components/`.
- Put React hooks in `spec-viewer/src/hooks/`.
- Put Tauri IPC wrappers and frontend utilities in `spec-viewer/src/lib/`.
- Put shared TypeScript shapes in `spec-viewer/src/types/`.
- Put global CSS and theme-level styles in `spec-viewer/src/styles/`.
- Keep `spec-viewer/src/App.tsx` focused on top-level composition and routing/state wiring.

## Rust File Placement

Use a lightweight DDD structure for the Rust/Tauri backend:

```text
spec-viewer/src-tauri/src/
├── app/
│   ├── mod.rs
│   ├── services/
│   └── use_cases/
├── domain/
│   ├── mod.rs
│   ├── comment/
│   ├── spec/
│   └── workspace/
├── infrastructure/
│   ├── mod.rs
│   ├── filesystem/
│   ├── markdown/
│   └── persistence/
├── presentation/
│   ├── mod.rs
│   └── commands/
├── lib.rs
└── main.rs
```

- Put Tauri command handlers and request/response DTOs in `presentation/commands/`.
- Put application orchestration in `app/use_cases/`; use cases call domain logic and infrastructure adapters.
- Put cross-use-case application services in `app/services/`.
- Put pure business concepts in `domain/`, including entities, value objects, domain errors, and traits that describe required repositories/services.
- Put workspace concepts under `domain/workspace/`.
- Put spec tree, logical file keys, and Markdown document concepts under `domain/spec/`.
- Put comment, anchor, resolution status, and comment-thread concepts under `domain/comment/`.
- Put filesystem access under `infrastructure/filesystem/`.
- Put Markdown parsing/hash implementation under `infrastructure/markdown/`.
- Put JSON comment storage and config loading under `infrastructure/persistence/`.
- Keep `spec-viewer/src-tauri/src/lib.rs` focused on plugin setup, dependency wiring, and command registration.
- Keep `spec-viewer/src-tauri/src/main.rs` as the thin executable entrypoint.

Dependency direction should be:

```text
presentation -> app -> domain
app -> infrastructure
infrastructure -> domain
domain -> no outer layer
```

Do not put Tauri types, filesystem paths, or JSON serialization details into domain types unless they are true domain concepts. Convert at the presentation or infrastructure boundary.

## Documentation Placement

- Put design-source notes in `spec-viewer/docs/design/`.
- Put implementation plans and task breakdowns in `spec-viewer/docs/plans/`.
- Keep the root `spec-viewer-plan.md` as historical/source planning context.

## Task File Workflow

- Active task files live under `spec-viewer/docs/plans/tasks/<group>/`.
- Completed task files must be moved to `spec-viewer/docs/plans/tasks/done/<group>/`.
- Before moving a task file to `done/`, mark its checklist items as complete and add a short completion note with the implementation commit or PR when available.
- Preserve the original task filename when moving it so history remains easy to follow.
- Update the source group's `README.md` so completed tasks no longer appear as active work.
- Update `spec-viewer/docs/plans/tasks/done/README.md` with a link to the moved task.
- Do not delete completed task files; moving them is the record that the task is finished.

## Generated Files

Do not commit generated output from:

- `spec-viewer/node_modules/`
- `spec-viewer/dist/`
- `spec-viewer/storybook-static/`
- `spec-viewer/src-tauri/target/`
- `spec-viewer/src-tauri/gen/`

## TypeScript 開発ルール

TypeScript コードを変更するすべての作業で、以下のスキルを **Skill ツールで実行**すること。
memory に過去の内容があっても省略せず、必ず Skill ツールで最新版を読み込むこと。

- 実装開始時は `implementation-workflow` スキルを Skill ツールで実行し、フローに従う
- コーディング中は `coding-standards` スキルを Skill ツールで実行
- テスト作成時は `tdd` および `testing` スキルを Skill ツールで実行
- コードレビュー時は `typescript-code-review-skill` スキルを Skill ツールで実行
- パフォーマンス確認時は `typescript-performance-review-skill` スキルを Skill ツールで実行

UI の確認は基本的に Storybook と `playwright-cli` を組み合わせて実施すること。
