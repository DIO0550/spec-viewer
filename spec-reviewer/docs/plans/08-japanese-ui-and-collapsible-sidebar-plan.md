# Japanese UI And Collapsible Sidebar Plan

## Goal

Improve the reviewer workspace so users can hide the right review sidebar when they want more Markdown reading space, and make the primary user-facing UI Japanese by default.

This plan is separate from the user-review filesystem loop. It covers the app shell, comment sidebar, review run panel, workspace controls, empty/loading/error states, and user-facing action labels.

## Design Direction

- Keep the app as a dense three-pane reviewer layout by default.
- Let the right sidebar collapse to a narrow icon rail or hidden panel.
- Preserve review state when the sidebar is closed.
- Use Japanese copy for visible UI text.
- Keep internal type names, IPC names, file names, and persisted JSON schema keys in English.
- Do not introduce locale switching or an internationalization framework. This app is designed for Japanese users first.

## System Diagrams

### Sidebar State Machine

```text
EXPANDED
  Right sidebar shows comments, user-review runs, filters, and actions
      |
      | User clicks close button / presses shortcut
      v
COLLAPSED
  Sidebar content is hidden, narrow reopen affordance remains visible
      |
      | User clicks reopen affordance / presses shortcut
      v
EXPANDED

EXPANDED
  |
  | Narrow viewport
  v
OVERLAY
  Sidebar overlays Markdown content and can be dismissed
      |
      | Dismiss / Escape
      v
COLLAPSED

State persistence:
COLLAPSED or EXPANDED -- app reload --> restore last sidebar preference

Error edge:
Any state -- selected workspace/spec/file changes --> keep sidebar preference, refresh content
```

### UI Copy Data Flow

```text
React components
  request display labels
      |
      v
src/lib/uiText.ts
  Japanese UI text constants
      |
      v
Components render:
  - toolbar labels
  - sidebar labels
  - button aria-labels
  - empty/loading/error messages
  - user-review status labels
      |
      v
Tests assert user-visible Japanese copy
```

## Scope

### Sidebar Behavior

- Add an icon button to close the right sidebar.
- Add a visible affordance to reopen the sidebar.
- Keep active comment, filters, search query, and selected review run state when hidden.
- Persist the sidebar open/closed preference for the current browser/app profile.
- On narrow viewports, treat the sidebar as an overlay that can be dismissed with Escape.
- Ensure Markdown pane width expands when the sidebar is closed.
- Ensure focus moves predictably:
  - Closing from inside the sidebar moves focus to the reopen affordance.
  - Reopening moves focus to the sidebar heading or first interactive control.

### Japanese UI Copy

Japanese copy should cover:

- Workspace toolbar.
- Spec tree empty/loading/error states.
- File tabs and missing-file labels.
- Markdown viewer empty/error states.
- Comment sidebar labels, filters, search, actions, and status messages.
- Add/edit/delete/resolve comment flows.
- User-review run creation, worktree selection, archive, result states.
- Export/prompt actions that remain visible.
- Accessibility labels for icon-only buttons.

Technical names should stay English where they are product or developer concepts:

- `worktree`
- `user-review`
- `plan-review`
- `code-review`
- `JSON`
- `Markdown`
- `LLM`

## Suggested Copy

| Area | Current Meaning | Japanese Copy |
| --- | --- | --- |
| Sidebar heading | Comments | コメント |
| Close sidebar | Hide right sidebar | サイドバーを閉じる |
| Reopen sidebar | Show right sidebar | サイドバーを開く |
| No comments | Empty comment list | コメントはまだありません |
| Open comments | Open filter | 未解決 |
| Resolved comments | Resolved filter | 解決済み |
| Orphaned comments | Orphaned filter | 位置不明 |
| Add comment | Add comment action | コメント追加 |
| Resolve | Resolve comment | 解決する |
| Reopen | Reopen comment | 再オープン |
| Delete | Delete comment | 削除 |
| Create review | User review bundle | レビュー作成 |
| Active review | Active user review run | 対応中レビュー |
| Archive review | Archive run | アーカイブへ移動 |
| Current workspace | Execution target | 現在のワークスペース |
| New worktree | Execution target | 新しいworktree |
| Copy folder path | Copy path | フォルダパスをコピー |
| Loading | Generic loading | 読み込み中 |
| Retry | Retry action | 再試行 |

## Implementation Shape

### Frontend Files

```text
spec-reviewer/src/
├── components/
│   ├── AppShell.tsx
│   ├── CommentSidebar.tsx
│   └── SidebarToggle.tsx
├── hooks/
│   └── useSidebarPreference.ts
└── lib/
    └── uiText.ts
```

### UI Text Constants

Use simple typed constants:

```ts
export const uiText = {
  sidebar: {
    comments: "コメント",
    close: "サイドバーを閉じる",
    open: "サイドバーを開く",
    empty: "コメントはまだありません",
  },
  reviewRun: {
    create: "レビュー作成",
    active: "対応中レビュー",
    archive: "アーカイブへ移動",
  },
} as const;
```

This avoids scattering Japanese strings while staying intentionally simpler than an internationalization layer.

## Migration Plan

1. **P4.10 Sidebar Collapse** - completed
   Add sidebar layout state, close/reopen controls, persistence, keyboard behavior, and responsive overlay handling.

2. **P4.11 Japanese UI Text Constants**
   Add typed Japanese UI text constants and migrate high-traffic UI labels.

3. **P4.12 Japanese Review Workflow Polish**
   Finish Japanese copy for comment mutations, user-review runs, worktree messages, archive flows, empty states, and errors.

4. **P4.13 UI QA**
   Verify desktop and narrow viewport screenshots, keyboard behavior, Japanese text fitting, and accessibility labels.

## Testing Plan

- Component tests for expanded/collapsed/overlay sidebar states.
- Hook tests for sidebar preference persistence.
- Keyboard tests for close, reopen, and Escape behavior.
- Component tests asserting Japanese labels for key actions and statuses.
- Visual QA with Storybook or Playwright for desktop and narrow viewports.
- Text fitting check for long Japanese labels in buttons and toolbar controls.

## Open Questions

- Should the sidebar default to open on first launch, then remember user preference?
- Should the reopen affordance be a narrow rail or a floating icon button?
- Should all existing English UI be migrated in one pass, or should the comment and user-review workflows come first?
- Should UI text constants be grouped by component or user workflow?
