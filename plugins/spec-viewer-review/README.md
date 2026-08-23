# Spec Viewer Review

Claude Code plugin that applies unresolved review comments created on repository Diffs in spec-viewer.

The plugin provides the `/spec-viewer-review:fix-diff-comments` skill. Pass one or more comment IDs to limit the repair, or omit arguments to process every unresolved comment in the current worktree.

The bundled reader locates the current worktree's private spec-viewer comment document without changing it. The skill edits source files and runs repository checks, but leaves comment resolution to spec-viewer.

## Local development

From the repository root:

```bash
claude --plugin-dir ./plugins/spec-viewer-review
```

## Marketplace installation

For the current checkout, add the repository root as a local marketplace:

```text
/plugin marketplace add .
/plugin install spec-viewer-review@spec-viewer-tools
```

After publishing the repository, add it from GitHub:

```text
/plugin marketplace add DIO0550/spec-viewer
/plugin install spec-viewer-review@spec-viewer-tools
```
