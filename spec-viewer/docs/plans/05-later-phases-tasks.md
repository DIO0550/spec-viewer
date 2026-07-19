# Later phase tasks

## Phase 4: UX improvements

- [ ] Add resolved/unresolved filters.
- [ ] Add comment search.
- [ ] Add dark and light theme support.
- [ ] Add drag-and-drop workspace open.
- [ ] Add recent workspace memory.
- [ ] Add feature-level config overrides.
- [ ] Add comment export to Markdown.
- [ ] Add comment export to JSON.
- [ ] Improve keyboard navigation for feature list, tabs, and sidebar.
- [ ] Add loading and error boundaries for IPC calls.
- [x] Add collapsible right sidebar.
- [x] Add Japanese-first UI copy for the primary reviewer workflow.
- [x] Add resizable right sidebar.
- [x] Clarify comment creation UX from Markdown line/block clicks.
- [x] Fix spec-driven-dev default Markdown file mapping.
- [ ] Add saved workspace switcher and startup restore.
- [ ] Add default-closed collapsible left navigation.
- [ ] Move download/export actions into a secondary menu.

## Phase 5: AI integration

- [ ] Add comment bundle export optimized for LLM prompts.
- [ ] Add selected-comments prompt generation.
- [ ] Add "Apply with AI" placeholder flow.
- [ ] Add generated diff preview before any file write.
- [ ] Add MCP feedback path to Spec Skill workflows.

## Design Polish

- [ ] Replace generated Tauri starter UI.
- [ ] Use a dense three-pane reviewer layout.
- [ ] Use icon buttons for open, refresh, resolve, delete, filter, and search.
- [ ] Keep cards only for repeated comment items and dialogs.
- [ ] Ensure mobile/narrow viewport fallback does not overlap text.

## Packaging

- [ ] Confirm app identifier.
- [ ] Replace default Tauri icons.
- [ ] Add build notes for Linux dev container.
- [ ] Add release checklist.

## Detailed Task Breakdown

### P4.1 Comment Filters

- [ ] Add filter state type.
- [ ] Add unresolved-only filter.
- [ ] Add resolved-only filter.
- [ ] Add orphaned-only filter after Phase 3.
- [ ] Add filter buttons to sidebar header.
- [ ] Persist last filter in memory for current session.
- [ ] Add tests for filter combinations.

### P4.2 Comment Search

- [ ] Add search query state.
- [ ] Search comment body.
- [ ] Search spec file key.
- [ ] Search orphaned snippet text.
- [ ] Highlight matching text in comment cards.
- [ ] Show no-results state.
- [ ] Add tests for search behavior.

### P4.3 Theme Support

- [ ] Define theme tokens in CSS.
- [ ] Add light theme.
- [ ] Add dark theme.
- [ ] Respect system color scheme by default.
- [ ] Add theme toggle control.
- [ ] Persist theme preference.
- [ ] Verify Markdown, comments, and tabs in both themes.

### P4.4 Drag And Drop Workspace Open

- [ ] Add frontend drop zone handling.
- [ ] Validate dropped item is a directory.
- [ ] Call workspace load use case with dropped path.
- [ ] Show invalid drop feedback.
- [ ] Preserve current workspace if dropped path fails.
- [ ] Add manual QA scenario.

### P4.5 Recent Workspaces

- [ ] Decide persistence mechanism.
- [ ] Store last opened workspace paths.
- [ ] Cap recent list length.
- [ ] Remove paths that no longer exist.
- [ ] Add recent workspace menu.
- [ ] Add clear recent workspaces action.

### P4.6 Config Overrides

- [ ] Define override file location.
- [ ] Add domain type for spec-level overrides.
- [ ] Merge workspace defaults, workspace config, and spec override config.
- [ ] Add validation errors for invalid overrides.
- [ ] Show override source in debug UI or logs.
- [ ] Add fixture tests.

### P4.7 Export Comments

- [ ] Define export target DTO.
- [ ] Export current file comments to Markdown.
- [ ] Export current spec comments to Markdown.
- [ ] Export workspace comments to JSON.
- [ ] Include orphaned/resolved state.
- [ ] Add save dialog.
- [ ] Add export success/failure feedback.

### P4.8 Keyboard Navigation

- [ ] Add focus model for spec tree.
- [ ] Add arrow-key navigation in spec tree.
- [ ] Add tab switching shortcuts.
- [ ] Add jump between comments shortcuts.
- [ ] Add escape handling for popovers.
- [ ] Document shortcuts outside the main app UI if needed.

### P4.9 Error Boundaries And Loading States

- [ ] Add root error boundary.
- [ ] Add command error display component.
- [ ] Add skeleton state for spec tree loading.
- [ ] Add skeleton state for Markdown loading.
- [ ] Add sidebar loading state.
- [ ] Add retry actions for recoverable failures.

### P4.10 Collapsible Sidebar And Japanese UI

- [x] Add right sidebar expanded/collapsed state.
- [x] Add close and reopen controls with Japanese accessible labels.
- [x] Persist sidebar open/closed preference.
- [x] Add narrow viewport overlay behavior and Escape dismissal.
- [x] Preserve comment and review-run state while hidden.
- [x] Add a typed Japanese UI copy catalog.
- [x] Migrate high-traffic app shell, comment sidebar, and user-review labels to Japanese.
- [x] Add tests for sidebar behavior, preference persistence, keyboard behavior, and Japanese labels.

### P4.11 Resizable Sidebar And Comment Entry UX

- [x] Add a draggable resize handle between Markdown pane and right sidebar.
- [x] Persist sidebar width separately from open/closed state.
- [x] Constrain sidebar width for desktop and narrow viewports.
- [x] Add Japanese accessible label for the resize handle.
- [x] Add empty-state guidance for how to create comments from Markdown line/block affordances.
- [x] Keep clicked Markdown line/block as the primary comment creation path.
- [x] Keep selected Markdown text as a secondary precision path.
- [x] Add tests for resizing, width persistence, viewport fallback, line/block comment affordances, and comment-entry hints.

### P4.12 Spec-driven-dev File Mapping

- [x] Change plugin-workspace defaults to `exploration-report.md`, `hearing-notes.md`, `implementation-plan.md`, and `tasks.md`.
- [x] Keep logical keys as `exploration`, `hearing`, `impl`, and `tasks`.
- [x] Update `src-tauri/src/domain/workspace/config.rs` default plugin-workspace mapping.
- [x] Update config, spec scanning, markdown read, and review-run tests that encode old plugin-workspace file names.
- [x] Update tests that still expect `exploration.md`, `hearing.md`, or `impl.md`.
- [x] Confirm a workspace like `.plugin-workspace/.specs/021-issue-262/` loads all four tabs without config overrides.
- [x] Confirm review-run manifests point at `implementation-plan.md` for logical key `impl`.
- [x] Reject retired `.spec-skill` workspace markers and keep only current `.plugin-workspace` mappings.

### P4.13 Saved Workspace Switcher

- [ ] Save every successfully opened workspace automatically.
- [ ] Save workspaces opened through folder picker and drag-and-drop.
- [ ] Persist workspace path, display name, workspace kind, last opened timestamp, and last active workspace.
- [ ] Restore the last active valid workspace on app startup.
- [ ] Add a Japanese toolbar switcher for saved workspaces.
- [ ] Let users switch saved workspaces without opening the OS folder picker.
- [ ] Keep the current workspace loaded if switching fails.
- [ ] Let users remove one saved workspace or clear the saved list.
- [ ] Add tests for auto-save, startup restore, switch success/failure, remove, clear, and dedupe.

### P4.14 Collapsible Left Navigation

- [ ] Add left navigation open/closed state.
- [ ] Default the left navigation to closed for first-time users.
- [ ] Persist the user's left navigation preference after manual open/close.
- [ ] Add draggable left navigation resize with independent width persistence.
- [ ] Constrain left navigation min/default/max width and restore a sane width on narrow viewports.
- [ ] Add Japanese open/close controls for the left navigation.
- [ ] Keep selected workspace/spec/file state when the left navigation is closed.
- [ ] Expand the Markdown reading pane while the left navigation is closed.
- [ ] Treat the left navigation as an overlay or drawer on narrow viewports.
- [ ] Add Escape and focus management behavior.
- [ ] Add tests for default-closed state, open/close controls, open/width preference persistence, resize constraints, Escape behavior, and layout expansion.

### P4.15 Secondary Export Actions

- [ ] Remove always-visible download/export buttons from the main right-sidebar flow.
- [ ] Keep raw file/spec/workspace comment export reachable from a secondary menu.
- [ ] Keep prompt copy/export reachable from a secondary menu.
- [ ] Keep `レビュー作成` as the visible primary handoff action.
- [ ] Use Japanese labels that distinguish raw export from user-review creation.
- [ ] Show export feedback only after an export action is triggered.
- [ ] Update tests for the new overflow/secondary export placement.

### P5.1 LLM Prompt Export

- [ ] Define prompt bundle format.
- [ ] Include selected Markdown context.
- [ ] Include unresolved comments.
- [ ] Include orphaned comments separately.
- [ ] Include workspace/spec/file metadata.
- [ ] Add copy-to-clipboard action.

### P5.2 Apply With AI Placeholder

- [ ] Add disabled or experimental action placement.
- [ ] Define selected-comments input model.
- [ ] Define generated diff preview model.
- [ ] Require explicit user confirmation before file writes.
- [ ] Keep Markdown write support out of default comment flow.

### P5.3 MCP Feedback Path

- [ ] Identify target Spec Skill MCP interface.
- [ ] Define feedback payload.
- [ ] Add adapter boundary.
- [ ] Add dry-run mode.
- [ ] Add user-visible result summary.

### P6.1 Packaging And Release

- [ ] Confirm final product name.
- [ ] Confirm Tauri identifier.
- [ ] Replace generated icons.
- [ ] Add Linux build notes.
- [ ] Add macOS build notes when available.
- [ ] Add Windows build notes when available.
- [ ] Add release checklist.
- [ ] Add smoke test checklist for packaged app.
