# Japanese UI And Collapsible Sidebar Plan

## Goal

Improve the reviewer workspace so users can hide or resize the right review sidebar when they want more Markdown reading space, make the primary user-facing UI Japanese by default, and make comment creation discoverable.

This plan is separate from the user-review filesystem loop. It covers the app shell, comment sidebar, review run panel, workspace controls, empty/loading/error states, and user-facing action labels.

## Design Direction

- Keep the app as a dense three-pane reviewer layout by default.
- Let the right sidebar collapse to a narrow icon rail or hidden panel.
- Let the right sidebar be resized by dragging a divider.
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
      | User drags resize handle
      v
RESIZING
  Sidebar width follows pointer between min/max constraints
      |
      | Pointer release
      v
EXPANDED
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
COLLAPSED or EXPANDED -- app reload --> restore last sidebar preference and saved width

Error edge:
Any state -- selected workspace/spec/file changes --> keep sidebar preference, refresh content
```

### Comment Creation Flow

```text
READING_MARKDOWN
  User reads rendered Markdown
      |
      | Hovers or focuses a rendered Markdown line/block
      v
LINE_COMMENT_TARGET
  Line/block gutter shows `コメント追加` affordance
      |
      | Clicks `コメント追加`
      v
COMMENT_DRAFT
  Popover shows target line/block preview and textarea
      |
      | Submit
      v
COMMENT_SAVED
  Comment persists to .comments/<logical-file>.json and line/block highlight appears
      |
      | Sidebar refreshes
      v
COMMENT_VISIBLE

Alternate path:
COMMENT_VISIBLE -- click highlight/sidebar item --> COMMENT_FOCUSED
COMMENT_FOCUSED -- edit/resolve/delete --> COMMENT_UPDATED

Edge cases:
LINE_COMMENT_TARGET -- unsupported block --> disable affordance or attach to nearest supported block
COMMENT_DRAFT -- empty body --> validation message
COMMENT_SAVED -- anchor cannot be resolved later --> shown as 位置不明 in sidebar
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
- Add a draggable resize handle between the Markdown pane and the right sidebar.
- Constrain sidebar width with a comfortable minimum and maximum.
- Persist the user's sidebar width preference.
- Restore a sane default if the saved width no longer fits the viewport.
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
- Inline hints for line/block comment creation.

### Comment Entry UX

The main way to create a user comment should be clicking a rendered Markdown line or block, similar to Kiro:

1. User moves the pointer over a rendered Markdown line/block, or focuses it with keyboard navigation.
2. A subtle gutter affordance appears on the left side of that line/block.
3. User clicks the affordance or the targetable line/block action.
4. A compact popover opens with:
   - target line/block preview,
   - textarea,
   - `保存`,
   - `キャンセル`.
5. Saving creates a comment anchored to that Markdown block, using the full block range when no exact text range is selected.
6. The line/block is highlighted and the comment appears in the right sidebar.

Text selection can remain as a secondary precision path:

1. User selects a specific phrase or sentence.
2. A small floating `コメント追加` button appears near the selection.
3. Clicking it opens a compact popover with:
   - selected text preview,
   - textarea,
   - `保存`,
   - `キャンセル`.
4. Saving creates a comment anchored to the selected Markdown block/range.

The sidebar should explain the flow when there are no comments:

```text
Markdown本文の行にあるコメントボタンから追加できます。
```

Do not make a generic unanchored `新規コメント` button the primary path. Unanchored comments can be considered later, but the first workflow should keep comments tied to Markdown line/block context so they can be exported to user-review bundles and applied by AI.

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
| Resize sidebar | Resize right sidebar | サイドバー幅を変更 |
| No comments | Empty comment list | コメントはまだありません |
| Comment hint | How to add comments | Markdown本文の行にあるコメントボタンから追加できます |
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
│   ├── CommentEntryHint.tsx
│   └── SidebarToggle.tsx
├── hooks/
│   ├── useSidebarPreference.ts
│   └── useResizableSidebar.ts
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
    resize: "サイドバー幅を変更",
    empty: "コメントはまだありません",
    addHint: "Markdown本文の行にあるコメントボタンから追加できます",
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

2. **P4.10 Japanese UI Text Constants** - completed
   Add typed Japanese UI text constants and migrate high-traffic UI labels.

3. **P4.11 Resizable Sidebar And Comment Entry UX** - completed
   Add drag resizing, width persistence, viewport constraints, and clearer comment creation guidance.

4. **P4.12 Japanese Review Workflow Polish**
   Finish Japanese copy for comment mutations, user-review runs, worktree messages, archive flows, empty states, and errors.

5. **P4.13 UI QA**
   Verify desktop and narrow viewport screenshots, keyboard behavior, Japanese text fitting, and accessibility labels.

## Testing Plan

- Component tests for expanded/collapsed/overlay sidebar states.
- Hook tests for sidebar preference persistence.
- Hook/component tests for sidebar resize constraints and width persistence.
- Keyboard tests for close, reopen, and Escape behavior.
- Component tests for the empty-comment hint, line/block comment affordance, and secondary text-selection affordance.
- Component tests asserting Japanese labels for key actions and statuses.
- Visual QA with Storybook or Playwright for desktop and narrow viewports.
- Text fitting check for long Japanese labels in buttons and toolbar controls.

## Open Questions

- Should the sidebar default to open on first launch, then remember user preference?
- Should the reopen affordance be a narrow rail or a floating icon button?
- What are the default, minimum, and maximum sidebar widths?
- Should double-clicking the resize handle reset to the default width?
- Should all existing English UI be migrated in one pass, or should the comment and user-review workflows come first?
- Should UI text constants be grouped by component or user workflow?
