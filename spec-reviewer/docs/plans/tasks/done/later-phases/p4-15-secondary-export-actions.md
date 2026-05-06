# P4.15 Secondary Export Actions

## Goal

Move raw comment export and prompt export actions out of the primary right-sidebar workflow. Users mostly review Markdown, add comments, and create user-review runs, so download/export buttons should not compete with those actions.

## Tasks

- [x] Remove always-visible download/export buttons from the main comment sidebar body.
- [x] Keep raw comment export available from a secondary menu such as `その他` or `エクスポート`.
- [x] Keep prompt copy/export available from the same secondary menu or a review-specific overflow menu.
- [x] Keep `レビュー作成` visible as the primary action for handing comments to an AI workflow.
- [x] Use Japanese labels that distinguish raw export from user-review creation.
- [x] Keep export success/error feedback visible only after the user triggers an export.
- [x] Preserve existing export and prompt-generation backend behavior.
- [x] Update component tests that currently expect visible download/export buttons.
- [x] Add tests that export actions are reachable from the secondary menu and no longer dominate the empty/comment list state.

## UI Copy

Suggested Japanese labels:

| Concept | Label |
| --- | --- |
| More actions | その他 |
| Export menu | エクスポート |
| Export current file comments | このファイルのコメントを書き出す |
| Export current spec comments | この仕様のコメントを書き出す |
| Export workspace comments | ワークスペースのコメントを書き出す |
| Copy prompt | AI用プロンプトをコピー |
| Create user review | レビュー作成 |

## Acceptance Criteria

- The right sidebar's default view emphasizes comments and `レビュー作成`, not download/export controls.
- Raw export remains available, but only through a secondary/overflow action.
- Empty comment state does not show download buttons.
- Existing file/spec/workspace export behavior still works after moving the controls.
- Existing prompt-copy behavior still works after moving the controls.

## Notes

- Do not remove export functionality; it is useful for occasional backup/debug workflows.
- The download icon can still be used inside the secondary menu if it helps recognition, but it should not be a primary persistent button.
- Prefer `レビュー作成` for the main AI handoff flow because it writes the structured `user-review/active/` bundle.

## Completion Note

Completed in commit b171e6f5036ff25f7e068206db86ca703cf0af63. Export, prompt, MCP feedback, and AI placeholder actions now live behind the `その他` secondary menu while `レビュー作成` remains the primary AI handoff action.
