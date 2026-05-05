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

