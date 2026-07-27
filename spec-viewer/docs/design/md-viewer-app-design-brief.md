# md-viewer-app design brief

## Source

Derived from `/workspace/md-viewer-app Design.html`.

## Product Direction

The design explores a Markdown viewer app for spec workspaces. The app presents a workspace/spec tree on the left, tabs for the currently selected spec Markdown files, and a reading surface for Markdown content.

## Workspace Model From Design

- Root target: `.plugin-workspace/.specs/`
- Left sidebar lists spec folders under `.specs/`.
- A selected spec can expand nested folders such as `code-review/`.
- The app is expected to support multiple workspaces.
- The footer should show the active workspace path.

## File Tabs From Design

The design names four primary Markdown tabs:

- `exploration`
- `hearing`
- `impl`
- `tasks`

This differs from the earlier `requirements / design / tasks` model. Implementation should either migrate to the four-file model or support configurable logical file groups before UI work hardens around the older three-tab naming.

## Layout Direction

- Three-pane desktop layout.
- Left: workspace/spec tree.
- Center: Markdown reader.
- Right: comments/review context when comment features are implemented.
- Archive content should appear lower in the tree and be collapsible.

## Visual Explorations

- `01 Standard`: Finder/Notes inspired, neutral, default recommended direction.
- `02 Technical`: dense, editor-like, more monospace usage.
- `03 Reader`: wider whitespace, serif body, Markdown-first reading.
- `04 Dark`: dark version of Standard.

## Recommended Starting Point

Use `01 Standard` as the initial implementation target because it best matches a productive desktop reviewer: familiar navigation, quiet visual hierarchy, and enough density for repeated use.



## Shared Review Shell (#192)

Issue #191 is the contract source for this shell. View mode is session-global with an initial value of Specs, while selected items are remembered by `(workspaceId, worktreeId, mode)`. Worktree row counts remain typed by mode: Specs shows the number of non-archived specs and Diff shows the number of logical changed-file entries. Spec-row file counts remain a separate configured-mapping contract.

The desktop shell has four explicit regions: Worktrees, mode navigation (Specs or Changes), central content, and Comments. The toolbar spans only mode navigation and central content and contains a workspace row of at least 50px plus a view-mode row of at least 58px.

Responsive reduction is fixed at these boundaries:

- `>=1200px`: all four columns are visible.
- `900–1199px`: Comments is a drawer.
- `761–899px`: Comments and Worktrees are drawers.
- `<=760px`: both remain drawers; mode navigation stacks above content, is sticky with a maximum height of 40vh, and content retains an independently scrollable minimum height of 60vh.

`WorkspaceWorktreesLoadState` is the frontend adapter boundary. Until a real data source is connected, the UI receives an explicit `data-source-not-connected` reason and keeps Specs usable. This phase adds no Rust/Tauri IPC, JSON persistence, or Diff side effect.
