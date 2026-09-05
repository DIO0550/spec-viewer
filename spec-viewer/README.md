# spec-viewer

Spec Skill が生成する Markdown 仕様をレビューするための Tauri desktop app.

## Product Metadata

- Product name: `Spec Viewer`
- App identifier: `io.github.dio0550.spec-viewer`
- Version: `0.1.0`

## Development

```bash
pnpm install
pnpm desktop
```

`pnpm desktop` starts the Tauri app. The Vite-only frontend server is still available with:

```bash
pnpm dev
```

## Usage

Workspace 選択から Specs / Diff review 完了までの一連の操作は
[Specs / Diff integrated review guide](./docs/integrated-review-guide.md) を参照してください。

- [Specs navigation guide](./docs/specs-navigation.md): Specs 階層、configured document 件数、progress、Markdown tab、Archive、keyboard
- [Repository Diff workspace guide](./docs/repository-diff-workspace.md): Changed / All、複数 file tab、Unified / Split / Editor
- [Diff comments](./docs/diff-comments.md): Diff line comment、filter / jump / resolve、JSON v1 schema、CAS、recovery
- [Phase 1 developer contract](./docs/design/integrated-review-contract.md): domain 境界、state scope、IPC DTO、persistence、error / fixture
- [Review Phase 1 regression suite](./docs/testing/review-phase-1-regression.md): Storybook、Playwright、native、VRT の確認手順

## Checks

```bash
pnpm check
pnpm build
```

## Storybook

```bash
pnpm storybook
pnpm build-storybook
```

Storybook は GitHub Pages (`https://dio0550.github.io/spec-viewer/`) にデプロイされる。PR では preview と visual regression も実行される。

## Packaging

Release preparation is documented in [docs/plans/release-packaging.md](./docs/plans/release-packaging.md).

```bash
pnpm package:debug
pnpm package:debug:linux
```

`pnpm package` creates release artifacts. Do not commit generated outputs from `dist/`, `storybook-static/`, `src-tauri/target/`, or `src-tauri/gen/`.

## Added Libraries

- `react-markdown` / `remark-gfm`: Markdown + GFM rendering.
- `lucide-react`: UI icons.
- `@tauri-apps/plugin-dialog`: project directory picker.
- `pulldown-cmark`: Rust-side Markdown block parsing.
- `sha2`: anchor text hashing.
- `uuid`: comment IDs.
- `chrono`: comment timestamps.
- `thiserror` / `anyhow`: Rust error handling.
