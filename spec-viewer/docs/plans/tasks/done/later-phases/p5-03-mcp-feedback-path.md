# P5.3 MCP Feedback Path

> 2026-09-26: MCP機能の計画はなくなり、このdry-runコピー機能は削除されました。以下は実装当時の記録です。

## Tasks

- [x] Identify target Spec Skill MCP interface.
- [x] Define feedback payload.
- [x] Add adapter boundary.
- [x] Add dry-run mode.
- [x] Add user-visible result summary.

## Completion Note

Added a frontend-only Spec Skill MCP feedback dry-run path with typed manual-copy payloads, an adapter boundary for payload creation/rendering, sidebar copy UI, and success/error feedback. No provider or connector integration was added. Implementation commit: this commit.
