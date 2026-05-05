# Acceptance checklist

## Development Environment

- [ ] `pnpm install` succeeds.
- [ ] `pnpm typecheck` succeeds.
- [ ] `pnpm lint` succeeds.
- [ ] `pnpm format:check` succeeds.
- [ ] `pnpm test:run` succeeds.
- [ ] `pnpm check` succeeds.
- [ ] `pnpm build` succeeds.
- [ ] `pnpm build-storybook` succeeds.
- [ ] `pnpm desktop` starts the Tauri app in the dev container.

## Phase 1 Acceptance

- [ ] User can choose a workspace folder.
- [ ] Invalid workspace shows a helpful error.
- [ ] Valid workspace with `.plugin-workspace/.specs/` loads successfully.
- [ ] Valid workspace with `.spec-skill/` loads successfully in compatibility mode.
- [ ] Spec tree displays directories under `.plugin-workspace/.specs/`.
- [ ] Exploration/hearing/impl/tasks tabs resolve filenames from config/defaults.
- [ ] Requirements/design/tasks tabs remain supported for `.spec-skill` compatibility.
- [ ] Missing Markdown files do not crash the app.
- [ ] Markdown renders GFM tables, task lists, code blocks, and headings.
- [ ] Rendered Markdown blocks include block type and block index attributes.

## Phase 2 Acceptance

- [ ] User can create comments from the active Markdown view.
- [ ] Comments are written to `.comments/<logical-file>.json`.
- [ ] Markdown files are not modified by comment operations.
- [ ] User can resolve and unresolve comments.
- [ ] User can delete comments.
- [ ] Comment sidebar updates after each operation.

## Phase 3 Acceptance

- [ ] Comments resolve by block type and block index when unchanged.
- [ ] Comments resolve by text hash after nearby block movement.
- [ ] Comments resolve by snippet when hash fails but text still exists.
- [ ] Orphaned comments are preserved and shown separately.
- [ ] File changes trigger comment re-resolution.

## Manual Review Scenarios

- [ ] Open a workspace with one feature and all three Markdown files.
- [ ] Open a workspace with multiple features.
- [ ] Open a workspace with custom design/tasks filenames.
- [ ] Open a workspace with a missing config file.
- [ ] Add comments, restart app, confirm comments persist.
- [ ] Regenerate or edit Markdown, confirm comments degrade gracefully.
