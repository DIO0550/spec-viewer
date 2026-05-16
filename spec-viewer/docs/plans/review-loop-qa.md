# Review loop QA guide

This guide closes the first review-loop implementation pass. The workflow is provider-independent and filesystem-based: `spec-reviewer` writes ordinary `user-review/` folders, and any external AI agent or editor can read those files and edit the source Markdown files.

User-facing terminology should stay Japanese-first. Use `ユーザーレビュー`, `レビュー作成`, `現在のワークスペース`, `新しいworktree`, `対応中レビュー`, `完了レビュー`, and `アーカイブ済み` in UI-facing docs and screenshots.

## Review bundle contract

A created review run writes a bundle under the selected spec folder:

```text
<spec-folder>/user-review/
├── active/
│   └── <review-run-id>/
│       ├── manifest.json
│       ├── instructions.md
│       ├── comments.json
│       ├── context/
│       ├── result.md
│       └── status.json
└── archive/
```

External agents should read `instructions.md`, `comments.json`, and `context/`, then edit the source Markdown files listed in `manifest.json`. Files under `context/` are read-only snapshots. After work, the agent should summarize results in `result.md` and, when possible, set `status.json` to `completed`.

## Japanese AI-agent instructions

Give the implementation agent instructions in Japanese first:

```text
このフォルダは spec-reviewer が作成したユーザーレビューです。
instructions.md と comments.json を読み、manifest.json の sourceFiles にある元の Markdown ファイルを修正してください。
context/ 配下は参照用スナップショットなので編集しないでください。
対応後は result.md に結果を書き、可能なら status.json の status を completed に更新してください。
この仕組みはプロバイダー非依存です。使用する AI ツールやエディタは問いません。
```

## Manual flow: current workspace mode

1. Open a spec-driven-dev workspace with at least one spec and Markdown file.
2. Add at least one comment in the Markdown viewer.
3. In `ユーザーレビュー`, choose `ファイル` or `Spec全体`.
4. Choose `現在のワークスペース`.
5. Click `レビュー作成`.
6. Confirm a new folder appears under `<spec-folder>/user-review/active/<review-run-id>/`.
7. Open the folder in an external editor or AI agent.
8. Edit the source Markdown file listed in `manifest.json`.
9. Write a short summary to `result.md`.
10. Set `status.json` to `completed`.
11. Refresh `対応中レビュー` in the app.
12. Confirm the UI shows the completed state and enables archive.
13. Archive the completed review.
14. Confirm the run moved to `<spec-folder>/user-review/archive/<review-run-id>/`.
15. Restart the app and confirm archived run metadata remains readable.
16. Add another comment on the same spec, create a second review, complete it, and archive it.
17. Confirm the first archive remains untouched and the second run uses a distinct folder.

Expected result: at least two review loops can complete on the same spec without overwriting archived runs.

## Manual flow: worktree mode

1. Start from a clean Git workspace. Commit or stash edits to target Markdown files before creating the review.
2. Add at least one comment in the Markdown viewer.
3. In `ユーザーレビュー`, choose `新しいworktree`.
4. Click `レビュー作成`.
5. Confirm the app displays a `spec-reviewer/<review-run-id>` branch and sibling worktree path.
6. Confirm the bundle exists inside the worktree's selected spec folder.
7. Point the external editor or AI agent at the worktree path.
8. Edit only source Markdown files in the worktree, not the original checkout and not `context/`.
9. Write a summary to `result.md` and set `status.json` to `completed`.
10. Refresh the app and archive the completed review.
11. Confirm the archived bundle remains under the worktree's spec folder and remains readable after app restart.
12. Create, complete, and archive a second review for the same spec.
13. Confirm the first archive remains untouched and the second run uses a distinct folder.

Expected result: worktree mode isolates edits on the review branch. Merge, rebase, deletion, pruning, and cleanup of created worktrees remain explicit user actions in this first version.

## QA checklist

- [ ] Review bundle contains `manifest.json`, `instructions.md`, `comments.json`, `context/`, `result.md`, and `status.json`.
- [ ] `instructions.md` is Japanese-first and clearly tells agents to edit source Markdown files, not `context/`.
- [ ] Current-workspace mode completes create, external edit, completed status refresh, archive, restart, and repeat.
- [ ] Worktree mode completes create, external edit, completed status refresh, archive, restart, and repeat.
- [ ] Archived runs remain readable after app restart.
- [ ] A second review run on the same spec does not overwrite the first archived run.
- [ ] Worktree mode blocks dirty target source files with a clear explanation.
- [ ] Documentation states the workflow is filesystem-based and provider-independent.
- [ ] Documentation states worktree merge and cleanup are explicit user actions.

## Limitations and follow-up ideas

- The app does not call AI providers, monitor agent processes, or validate external edits automatically.
- The app does not merge, rebase, delete, prune, or clean up worktrees.
- Worktree mode requires target source files to be clean before review creation.
- Archive remains a user-confirmed action and only completed reviews can be archived.
- Future work could add guarded worktree cleanup, richer changed-file summaries, optional auto-detection of completed `status.json`, and a dedicated archived-run detail viewer.
