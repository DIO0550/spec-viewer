# Design initialization

## Source

`/workspace/md-viewer-app Design.html`

## What Changed In The Product Plan

The design source introduces a slightly different product shape from the original `spec-reviewer-plan.md`:

- Workspace root is `.plugin-workspace/.specs/`, not `.spec-skill/features/`.
- Specs are listed as folders under `.specs/`.
- The primary Markdown file set is `exploration / hearing / impl / tasks`, not `requirements / design / tasks`.
- Multiple workspaces should be supported eventually.
- The left sidebar should be a tree, not a flat feature list.

## Decision For Implementation

Use the current workspace layouts only:

- `.plugin-workspace/.specs/`
- `.plugin-worktree/.specs/`

The first implementation should avoid hard-coding visible tab labels around the old three-file model. Instead, logical spec files should be driven by configuration/defaults.

## Updated Implementation Priorities

1. Build a workspace detector for `.plugin-workspace/.specs/` and `.plugin-worktree/.specs/`.
2. Represent specs as a tree-compatible structure.
3. Default the UI tabs to `exploration`, `hearing`, `impl`, and `tasks` when using `.plugin-workspace/.specs/`.
4. Reject unsupported legacy workspace markers instead of migrating them silently.
5. Use the Standard visual exploration as the first UI target.

