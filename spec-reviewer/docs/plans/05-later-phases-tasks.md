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
