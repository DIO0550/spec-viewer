# Phase 1 tasks: viewer foundation

## Goal

Load a spec workspace and provide a usable Markdown viewer for configured Markdown files. The first UI target follows the `md-viewer-app` design: `.plugin-workspace/.specs/` tree plus `exploration / hearing / impl / tasks` tabs.

## Rust Tasks

- [ ] Add `config.rs`.
- [ ] Define `SpecFileKey` for `exploration`, `hearing`, `impl`, and `tasks`.
- [ ] Add compatibility aliases for `requirements`, `design`, and `tasks` if `.spec-skill/` mode is detected.
- [ ] Define `WorkspaceConfig` matching `.spec-skill/config.json`.
- [ ] Define workspace detection for `.plugin-workspace/.specs/` and `.spec-skill/`.
- [ ] Implement config loading with sensible defaults when config is absent.
- [ ] Validate that selected workspace contains a supported spec root.
- [ ] Add `feature.rs`.
- [ ] Scan `.plugin-workspace/.specs/` for spec directories.
- [ ] Preserve tree shape for nested folders such as `code-review/`.
- [ ] Keep `.spec-skill/features/` scanning as compatibility mode.
- [ ] Resolve logical spec files to actual paths using config.
- [ ] Return feature metadata including which files exist.
- [ ] Add `commands.rs`.
- [ ] Expose `load_workspace(path)`.
- [ ] Expose `list_specs(workspace_path)`.
- [ ] Keep or alias `list_features(workspace_path)` only if needed by compatibility UI.
- [ ] Expose `read_spec_file(workspace_path, feature_id, file_key)`.

## TypeScript Tasks

- [ ] Add `src/types/feature.ts`.
- [ ] Add `src/types/spec.ts`.
- [ ] Add `src/lib/tauri.ts` wrapper for typed IPC calls.
- [ ] Add `src/hooks/useWorkspace.ts`.
- [ ] Add `src/hooks/useFeatures.ts`.
- [ ] Add `FeatureList` component.
- [ ] Add `SpecTabs` component.
- [ ] Add `MarkdownViewer` component using `react-markdown` and `remark-gfm`.
- [ ] Add app layout with left feature list, main Markdown pane, and reserved right sidebar.
- [ ] Use the Standard design direction as the initial visual target.

## UI Behavior

- [ ] App starts with an empty state and an open-workspace button.
- [ ] Open-workspace uses `@tauri-apps/plugin-dialog`.
- [ ] Selecting a valid workspace loads the spec tree.
- [ ] Selecting a spec loads the first available logical file.
- [ ] Tabs switch between exploration, hearing, impl, and tasks in `.plugin-workspace` mode.
- [ ] Missing files render a clear empty state.
- [ ] Markdown blocks receive stable `data-block-type` and `data-block-index` attributes in the rendered DOM.

## Tests

- [ ] Rust unit tests for config defaults.
- [ ] Rust unit tests for config filename mapping.
- [ ] Rust unit tests for feature scanning.
- [ ] React tests for tab switching.
- [ ] React tests for empty workspace and missing file states.

## Detailed Task Breakdown

### P1.1 Backend Module Skeleton

- [ ] Create `src-tauri/src/domain/mod.rs`.
- [ ] Create `src-tauri/src/domain/workspace/mod.rs`.
- [ ] Create `src-tauri/src/domain/spec/mod.rs`.
- [ ] Create `src-tauri/src/app/mod.rs`.
- [ ] Create `src-tauri/src/app/use_cases/mod.rs`.
- [ ] Create `src-tauri/src/infrastructure/mod.rs`.
- [ ] Create `src-tauri/src/infrastructure/filesystem/mod.rs`.
- [ ] Create `src-tauri/src/infrastructure/persistence/mod.rs`.
- [ ] Create `src-tauri/src/presentation/mod.rs`.
- [ ] Create `src-tauri/src/presentation/commands/mod.rs`.
- [ ] Wire modules from `src-tauri/src/lib.rs`.

### P1.2 Workspace Domain

- [ ] Add `WorkspaceRoot` value object.
- [ ] Add `WorkspaceKind` enum for `PluginWorkspace` and `SpecSkill`.
- [ ] Add `WorkspaceLayout` domain type.
- [ ] Add validation for supported workspace layouts.
- [ ] Add domain error variants for missing root and unsupported layout.

### P1.3 Spec File Domain

- [ ] Add `SpecFileKey` value object or enum.
- [ ] Add default keys for `exploration`, `hearing`, `impl`, and `tasks`.
- [ ] Add compatibility keys for `requirements`, `design`, and `tasks`.
- [ ] Add display labels for each logical key.
- [ ] Add `SpecFile` domain type.
- [ ] Add `SpecNode` domain type for tree-compatible spec folders.

### P1.4 Config Domain And Defaults

- [ ] Add `WorkspaceConfig` domain type.
- [ ] Add default config for `.plugin-workspace/.specs/`.
- [ ] Add default config for `.spec-skill/features/`.
- [ ] Add merge behavior for user config over defaults.
- [ ] Add validation for duplicate logical file keys.
- [ ] Add validation for unsafe file names or parent path traversal.

### P1.5 Infrastructure: Workspace Detection

- [ ] Add filesystem adapter to check path existence.
- [ ] Detect `.plugin-workspace/.specs/`.
- [ ] Detect `.spec-skill/features/`.
- [ ] Prefer `.plugin-workspace/.specs/` when both exist.
- [ ] Return `WorkspaceLayout` from infrastructure.
- [ ] Add tests for each detection branch.

### P1.6 Infrastructure: Config Loading

- [ ] Define expected config file locations for each workspace kind.
- [ ] Read config JSON if present.
- [ ] Fall back to workspace-kind defaults when absent.
- [ ] Return typed config errors for malformed JSON.
- [ ] Return typed config errors for invalid file mappings.
- [ ] Add tests for missing, valid, malformed, and partial configs.

### P1.7 Infrastructure: Spec Tree Scan

- [ ] Scan `.plugin-workspace/.specs/` directories.
- [ ] Preserve nested folders like `code-review/`.
- [ ] Ignore hidden internal folders except required app-managed folders.
- [ ] Scan `.spec-skill/features/` for compatibility mode.
- [ ] Resolve configured Markdown files for each spec node.
- [ ] Include missing-file status per logical file.
- [ ] Sort folders and specs deterministically.
- [ ] Add tests using temporary fixture directories.

### P1.8 Infrastructure: Markdown Read

- [ ] Resolve a spec file path from workspace root, spec id, and file key.
- [ ] Prevent reads outside the workspace root.
- [ ] Return a not-found result for missing configured files.
- [ ] Read Markdown as UTF-8.
- [ ] Return typed errors for invalid paths and unreadable files.
- [ ] Add tests for valid read, missing file, and traversal attempts.

### P1.9 App Use Cases

- [ ] Add `load_workspace` use case.
- [ ] Add `list_specs` use case.
- [ ] Add `read_spec_file` use case.
- [ ] Keep use cases independent from Tauri command types.
- [ ] Map infrastructure errors to app-level errors.
- [ ] Add use case tests with fake adapters where practical.

### P1.10 Presentation Commands

- [ ] Add `presentation/commands/workspace.rs`.
- [ ] Add `presentation/commands/specs.rs`.
- [ ] Define request DTOs for workspace path, spec id, and file key.
- [ ] Define response DTOs for workspace, spec tree, and Markdown file content.
- [ ] Convert app errors to serializable command errors.
- [ ] Register commands in `lib.rs`.
- [ ] Remove or isolate the starter `greet` command.

### P1.11 Frontend Types And IPC

- [ ] Add `src/types/workspace.ts`.
- [ ] Add `src/types/spec.ts`.
- [ ] Add `src/types/ipc.ts`.
- [ ] Add `src/lib/tauri.ts` wrapper around `invoke`.
- [ ] Add typed `loadWorkspace`.
- [ ] Add typed `listSpecs`.
- [ ] Add typed `readSpecFile`.
- [ ] Add error normalization for command failures.

### P1.12 Frontend State Hooks

- [ ] Add `src/hooks/useWorkspace.ts`.
- [ ] Add workspace path state.
- [ ] Add workspace loading/error state.
- [ ] Add `src/hooks/useSpecs.ts`.
- [ ] Add selected spec state.
- [ ] Add selected file key state.
- [ ] Add Markdown content loading/error state.
- [ ] Reset selected spec and file when workspace changes.

### P1.13 Layout Components

- [ ] Add `src/components/AppShell.tsx`.
- [ ] Add `src/components/WorkspaceToolbar.tsx`.
- [ ] Add `src/components/SpecTree.tsx`.
- [ ] Add `src/components/SpecTabs.tsx`.
- [ ] Add `src/components/MarkdownViewer.tsx`.
- [ ] Add `src/components/EmptyState.tsx`.
- [ ] Add `src/components/ErrorState.tsx`.
- [ ] Keep starter Tauri sample UI out of the final app shell.

### P1.14 Markdown Rendering

- [ ] Render Markdown with `react-markdown`.
- [ ] Enable `remark-gfm`.
- [ ] Render code blocks with stable styling.
- [ ] Render GFM tables without layout overflow.
- [ ] Render task lists read-only.
- [ ] Add `data-block-type` attributes for headings, paragraphs, list items, tables, and code blocks.
- [ ] Add `data-block-index` attributes within the rendered document.
- [ ] Keep block indexing stable for unchanged Markdown.

### P1.15 Viewer UI Behavior

- [ ] Start with an open-workspace empty state.
- [ ] Open workspace with `@tauri-apps/plugin-dialog`.
- [ ] Load spec tree after selecting a valid workspace.
- [ ] Select the first available spec by default.
- [ ] Select the first available file tab by default.
- [ ] Show missing-file empty state for absent configured files.
- [ ] Show active workspace path in a footer or toolbar.
- [ ] Keep the right sidebar reserved for comments.

### P1.16 Styling

- [ ] Implement the Standard visual direction from the design brief.
- [ ] Use a dense three-pane layout.
- [ ] Keep navigation quiet and scannable.
- [ ] Avoid nested cards.
- [ ] Use icon buttons for open and refresh.
- [ ] Ensure text does not overlap at narrow widths.
- [ ] Keep Markdown reader comfortable for long documents.
