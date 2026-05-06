# spec-reviewer

Spec Skill が生成する Markdown 仕様をレビューするための Tauri desktop app.

## Product Metadata

- Product name: `Spec Reviewer`
- App identifier: `io.github.dio0550.spec-reviewer`
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

## Checks

```bash
pnpm check
pnpm build
```

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
