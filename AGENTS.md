# AGENTS.md

## Scope

This repository contains the `spec-reviewer` Tauri application and supporting planning documents. Keep new implementation work inside `spec-reviewer/` unless the change is clearly about repository tooling or the dev container.

## Repository Structure

```text
.
├── AGENTS.md
├── README.md
├── spec-reviewer-plan.md
├── md-viewer-app Design.html
├── .devcontainer/
└── spec-reviewer/
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

- Put reusable React UI in `spec-reviewer/src/components/`.
- Put React hooks in `spec-reviewer/src/hooks/`.
- Put Tauri IPC wrappers and frontend utilities in `spec-reviewer/src/lib/`.
- Put shared TypeScript shapes in `spec-reviewer/src/types/`.
- Put global CSS and theme-level styles in `spec-reviewer/src/styles/`.
- Keep `spec-reviewer/src/App.tsx` focused on top-level composition and routing/state wiring.

## Rust File Placement

Use a lightweight DDD structure for the Rust/Tauri backend:

```text
spec-reviewer/src-tauri/src/
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
- Keep `spec-reviewer/src-tauri/src/lib.rs` focused on plugin setup, dependency wiring, and command registration.
- Keep `spec-reviewer/src-tauri/src/main.rs` as the thin executable entrypoint.

Dependency direction should be:

```text
presentation -> app -> domain
app -> infrastructure
infrastructure -> domain
domain -> no outer layer
```

Do not put Tauri types, filesystem paths, or JSON serialization details into domain types unless they are true domain concepts. Convert at the presentation or infrastructure boundary.

## Documentation Placement

- Put design-source notes in `spec-reviewer/docs/design/`.
- Put implementation plans and task breakdowns in `spec-reviewer/docs/plans/`.
- Keep the root `spec-reviewer-plan.md` as historical/source planning context.

## Generated Files

Do not commit generated output from:

- `spec-reviewer/node_modules/`
- `spec-reviewer/dist/`
- `spec-reviewer/storybook-static/`
- `spec-reviewer/src-tauri/target/`
- `spec-reviewer/src-tauri/gen/`

## TypeScript 開発ルール

TypeScript コードを変更するすべての作業で、以下のスキルを **Skill ツールで実行**すること。
memory に過去の内容があっても省略せず、必ず Skill ツールで最新版を読み込むこと。

- 実装開始時は `implementation-workflow` スキルを Skill ツールで実行し、フローに従う
- コーディング中は `coding-standards` スキルを Skill ツールで実行
- テスト作成時は `tdd` および `testing` スキルを Skill ツールで実行
- コードレビュー時は `typescript-code-review-skill` スキルを Skill ツールで実行
- パフォーマンス確認時は `typescript-performance-review-skill` スキルを Skill ツールで実行

UI の確認は基本的に Storybook と `playwright-cli` を組み合わせて実施すること。
