# spec-reviewer

Spec Skill が生成する Markdown 仕様をレビューするための Tauri desktop app.

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

## Added Libraries

- `react-markdown` / `remark-gfm`: Markdown + GFM rendering.
- `lucide-react`: UI icons.
- `@tauri-apps/plugin-dialog`: project directory picker.
- `pulldown-cmark`: Rust-side Markdown block parsing.
- `sha2`: anchor text hashing.
- `uuid`: comment IDs.
- `chrono`: comment timestamps.
- `thiserror` / `anyhow`: Rust error handling.
