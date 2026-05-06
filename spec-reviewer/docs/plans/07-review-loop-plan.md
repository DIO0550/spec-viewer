# Review Loop Export Plan

## Goal

Add a provider-independent review loop that lets users turn Markdown comments into a filesystem user-review bundle, hand that bundle to an implementation AI agent, and archive the bundle after the AI has completed the requested fixes.

The app should not call an AI provider for this workflow. It should create and manage durable user review folders that external tools can read and update.

## Design Direction

Use a file-backed user review run model:

- A user creates comments in the Markdown viewer.
- The app exports selected comments and Markdown context into a user review run folder inside the target spec-driven-dev spec folder.
- Optionally, the app creates a dedicated `git worktree` for the review run and writes the user review bundle into that worktree's spec folder.
- The user points an AI agent at that folder.
- The AI reads the instructions and edits the source spec Markdown files in the selected execution target.
- When the user confirms the AI work is complete, the app archives the review run folder.
- The user can repeat the loop with new comments.

This keeps the review source of truth in ordinary files, avoids provider lock-in, and preserves each review pass as an auditable artifact.

This is distinct from spec-driven-dev's AI-owned review folders. `plan-review/` stores another AI's review of `implementation-plan.md`, and `code-review/` stores another AI's review of implementation changes. The `user-review/` folder stores comments created by the user in `spec-reviewer` and handed to an implementation AI as work instructions.

## System Diagrams

### State Machine / Flow

```text
COMMENTING
  User adds or updates comments on Markdown
      |
      | Export selected comments
      v
REVIEW_RUN_DRAFT
  App prepares manifest, instructions, comments, and context
      |
      | Write succeeds
      v
WORKTREE_CHOICE
  User chooses current workspace or isolated git worktree
      |
      | Current workspace
      v
ACTIVE_REVIEW_RUN
  Folder exists under <spec-folder>/user-review/active/<review-run-id>/
      ^
      | Worktree created
      |
WORKTREE_READY
  Dedicated git worktree and branch exist for the review run
      |
      | User or external AI starts work
      v
AI_IN_PROGRESS
  AI reads bundle and modifies source Markdown files
      |
      | AI writes completion note or user marks complete
      v
READY_TO_ARCHIVE
  App shows completion summary and changed-file hints
      |
      | User confirms archive
      v
ARCHIVED_REVIEW_RUN
  Folder moved to <spec-folder>/user-review/archive/<review-run-id>/
      |
      | User adds new comments
      v
COMMENTING

Error transitions:

REVIEW_RUN_DRAFT -- write failure --> EXPORT_FAILED
WORKTREE_CHOICE -- git unavailable/not repository --> WORKTREE_UNAVAILABLE
WORKTREE_READY -- branch/path conflict --> WORKTREE_FAILED
ACTIVE_REVIEW_RUN -- missing folder --> REVIEW_RUN_MISSING
AI_IN_PROGRESS -- conflicting source changes --> READY_TO_ARCHIVE_WITH_WARNINGS
READY_TO_ARCHIVE -- move failure --> ARCHIVE_FAILED
```

### Data Flow

```text
React Comment UI
  comments, selected scope, selected comment ids
      |
      v
Tauri command: create_review_run
      |
      v
App use case
  - load comments
  - resolve anchors
  - read Markdown context
  - optionally create git worktree
  - create review manifest
      |
      v
Filesystem adapter
  target spec-driven-dev spec folder in current workspace or review worktree
      |
      v
user-review/
  active/
    <review-run-id>/
      manifest.json
      instructions.md
      comments.json
      context/
        <spec-id>/
          <file-key>.md
      result.md
      status.json

External AI agent
  reads active review folder
  edits source Markdown files in the selected workspace/worktree
  optionally updates result.md/status.json
      |
      v
React Review Runs UI
  lists active runs, status, warnings, archive action
      |
      v
Tauri command: archive_review_run
      |
      v
user-review/archive/<review-run-id>/
```

## Folder Structure

### Current Implementation

```text
spec-reviewer/
├── src/
│   ├── components/
│   │   └── CommentSidebar.tsx
│   ├── hooks/
│   │   └── useComments.ts
│   ├── lib/
│   │   ├── tauri.ts
│   │   └── mcpFeedback.ts
│   └── types/
│       └── comment.ts
└── src-tauri/src/
    ├── app/use_cases/comments.rs
    ├── infrastructure/persistence/
    │   ├── comment_store.rs
    │   └── comment_paths.rs
    └── presentation/commands/comments.rs
```

### Target Structure

```text
spec-reviewer/
├── src/
│   ├── components/
│   │   ├── CommentSidebar.tsx
│   │   ├── ReviewRunPanel.tsx
│   │   └── ReviewRunActions.tsx
│   ├── hooks/
│   │   └── useReviewRuns.ts
│   ├── lib/
│   │   └── tauri.ts
│   └── types/
│       └── reviewRun.ts
└── src-tauri/src/
    ├── app/use_cases/
    │   └── review_runs.rs
    ├── domain/review_run/
    │   ├── mod.rs
    │   └── repository.rs
    ├── infrastructure/persistence/
    │   ├── review_run_paths.rs
    │   └── review_run_store.rs
    └── presentation/commands/
        └── review_runs.rs
```

Review run folders should be created near the reviewed specs so external AI tools can inspect both review artifacts and source Markdown without special app integration:

```text
<workspace>/.plugin-workspace/.specs/{nnn}-{feature-name}/user-review/
├── active/
│   └── 2026-05-06T120000Z-file-requirements/
└── archive/
    └── 2026-05-06T113000Z-file-design/
```

For `.spec-skill` compatibility workspaces, use the corresponding feature folder:

```text
<workspace>/.spec-skill/features/{feature-name}/user-review/
├── active/
└── archive/
```

Workspace-wide review runs are out of scope for the first version because this workflow is intended to hand one spec-driven-dev feature folder to an implementation AI. File and spec scope are the initial targets.

When worktree isolation is enabled, the review run should be created in a dedicated Git worktree instead of the currently opened workspace:

```text
<workspace-parent>/<workspace-name>-worktrees/
└── <review-run-id>/
    └── .plugin-workspace/.specs/{nnn}-{feature-name}/user-review/
        ├── active/
        │   └── <review-run-id>/
        └── archive/
```

The branch name should be deterministic and human-readable, for example:

```text
spec-reviewer/<review-run-id>
```

The app should record the worktree path and branch name, but it should not merge, rebase, delete, or prune worktrees in the first version. Cleanup and merge remain explicit user actions unless a later task adds guarded UI for them.

Worktree mode should check for uncommitted changes in the target spec files before creating the review run. The first version should block worktree mode when target files are dirty, because the new worktree would be created from committed Git state and could omit the user's latest spec edits. Users can either commit/stash first or use current-workspace mode.

This folder must not be confused with the AI-owned review folders used by spec-driven-dev variants:

```text
<workspace>/.plugin-workspace/.specs/{nnn}-{feature-name}/
├── plan-review/   # another AI reviews the generated implementation plan
├── code-review/   # another AI reviews implementation changes
└── user-review/   # user comments exported by spec-reviewer for implementation work
```

## Review Bundle Format

### manifest.json

```json
{
  "schemaVersion": "spec-reviewer.review-run.v1",
  "id": "2026-05-06T120000Z-file-requirements",
  "status": "active",
  "workspacePath": "/path/to/workspace",
  "target": {
    "scope": "file",
    "specId": "001-checkout-flow",
    "fileKey": "requirements"
  },
  "specFolderPath": "/path/to/workspace/.plugin-workspace/.specs/001-checkout-flow",
  "executionTarget": {
    "mode": "worktree",
    "repositoryPath": "/path/to/workspace",
    "worktreePath": "/path/to/workspace-worktrees/2026-05-06T120000Z-file-requirements",
    "branchName": "spec-reviewer/2026-05-06T120000Z-file-requirements"
  },
  "sourceFiles": [
    {
      "specId": "001-checkout-flow",
      "fileKey": "requirements",
      "relativePath": ".plugin-workspace/.specs/001-checkout-flow/requirements.md"
    }
  ],
  "commentIds": ["cmt_1", "cmt_2"],
  "createdAt": "2026-05-06T12:00:00Z",
  "archivedAt": null
}
```

### instructions.md

The human-readable entrypoint for AI agents. It should be Japanese because the target users write review comments in Japanese. It should include:

- Target scope and source files.
- Clear instruction to edit the source Markdown files in the selected workspace/worktree, not files under `context/`.
- Comment list grouped by file.
- Anchor snippets and current resolution state.
- Completion contract: update `result.md` and optionally set `status.json` to `completed`.

### comments.json

The machine-readable comment payload. It should reuse existing comment response shapes where possible and include open/resolved/orphaned state.

### context/

Markdown snapshots at export time. These files are read-only context for AI agents and for later audit. The bundle should tell agents not to edit context snapshots.

### result.md

Created by the app as a Japanese blank template. AI agents or users can summarize completed changes, skipped comments, and follow-up questions.

### status.json

```json
{
  "status": "active",
  "updatedAt": "2026-05-06T12:00:00Z",
  "summary": null,
  "warnings": []
}
```

Allowed statuses:

- `active`: exported and waiting for AI work.
- `inProgress`: optional status set by an AI/user.
- `completed`: AI/user says the source Markdown changes are done.
- `archived`: app has moved the run to archive.

## Key Components

### User Review Run Domain

```rust
pub struct UserReviewRun {
    pub id: UserReviewRunId,
    pub status: UserReviewRunStatus,
    pub target: UserReviewRunTarget,
    pub execution_target: UserReviewExecutionTarget,
    pub spec_folder_path: SpecFolderPath,
    pub source_files: Vec<UserReviewSourceFile>,
    pub comment_ids: Vec<CommentId>,
    pub created_at: DateTime<Utc>,
    pub archived_at: Option<DateTime<Utc>>,
}
```

The domain should validate stable IDs, status transitions, target scope, and source file references without depending on Tauri types.

### Review Run Commands

```rust
#[tauri::command]
pub fn create_review_run(
    state: State<CommandState>,
    request: CreateReviewRunRequest,
) -> CommandResult<CreateReviewRunResponse>

#[tauri::command]
pub fn list_review_runs(
    state: State<CommandState>,
    request: ListReviewRunsRequest,
) -> CommandResult<ListReviewRunsResponse>

#[tauri::command]
pub fn archive_review_run(
    state: State<CommandState>,
    request: ArchiveReviewRunRequest,
) -> CommandResult<ArchiveReviewRunResponse>
```

### Frontend Types

```ts
export type ReviewRunStatus =
  | "active"
  | "inProgress"
  | "completed"
  | "archived";

export type CreateReviewRunRequest = Readonly<{
  workspacePath: string;
  target: ExportCommentsTarget;
  commentIds: readonly CommentId[];
  executionMode: "currentWorkspace" | "worktree";
}>;

export type ReviewRun = Readonly<{
  id: string;
  status: ReviewRunStatus;
  target: ExportCommentsTarget;
  executionTarget:
    | Readonly<{ mode: "currentWorkspace"; workspacePath: string }>
    | Readonly<{
        mode: "worktree";
        repositoryPath: string;
        worktreePath: string;
        branchName: string;
      }>;
  specFolderPath: string;
  folderPath: string;
  commentCount: number;
  createdAt: string;
  archivedAt: string | null;
}>;
```

### UI

- Use Japanese UI copy for this workflow.
- Add a `レビュー作成` action near the existing export controls.
- Let the user choose scope and selected/open comments with Japanese labels.
- Let the user choose `現在のワークスペース` or `新しいworktree` before creating the run.
- Show the created active folder path after export with Japanese success/error messages.
- Show worktree path and branch name when worktree isolation is used.
- Add an active review run list with Japanese status labels, open folder path copy, refresh, and archive actions.
- Keep the existing prompt/MCP controls available, but do not make them part of this workflow.
- Label this feature as `ユーザーレビュー` in UI copy so it is not confused with `plan-review/` or `code-review/`.

Suggested Japanese labels:

| Concept | Label |
| --- | --- |
| Create review | レビュー作成 |
| Current workspace | 現在のワークスペース |
| New worktree | 新しいworktree |
| Active review | 対応中レビュー |
| Completed review | 完了レビュー |
| Archive review | アーカイブへ移動 |
| Copy folder path | フォルダパスをコピー |
| Open comments only | 未解決コメントのみ |
| Include resolved comments | 解決済みコメントも含める |

## Benefits

1. Provider-independent: any AI agent can read the same folder.
2. Auditable: every review pass has comments, context, result, and archive history.
3. Safe: source Markdown writes are performed by the user-chosen AI workflow, not implicitly by the app.
4. Isolated when needed: worktree mode lets AI edit a separate branch without touching the user's current checkout.
5. Repeatable: archive completed runs, then create the next review run from fresh comments.
6. Compatible with current architecture: reuse comment listing, anchor resolution, Markdown reads, and export DTOs.

## Implementation Status

### Already Available

- Markdown comments are persisted separately from source Markdown.
- Comments can be filtered, searched, resolved, reopened, and exported.
- File/spec comments export to Markdown.
- Workspace comments export to JSON.
- LLM prompt generation exists for manual copy.
- Apply AI is currently a placeholder only.

### Missing

- User review run domain and folder lifecycle.
- Git repository/worktree detection and creation.
- Review bundle writer.
- Japanese UI copy and bundle templates.
- Active/archive review run listing.
- Completion/status detection.
- Archive action.
- UI for the review loop.

## Migration Plan

1. **Phase RL.1: User Review Run Model**
   Define domain types, frontend types, manifest/status schemas, and path rules for `user-review/active/` and `user-review/archive/`.

2. **Phase RL.2: Bundle Export**
   Add backend use case and command to create active user review folders with manifest, Japanese instructions, comments, context, Japanese result template, and status.

3. **Phase RL.3: Worktree Isolation**
   Add optional Git worktree creation, branch naming, worktree path validation, and manifest metadata.

4. **Phase RL.4: Active Review UI**
   Add Japanese create-review action and active review run panel. Show folder paths and copy/open affordances.

5. **Phase RL.5: Completion And Archive**
   Read `status.json`, surface completed/warning states, and move completed runs from `user-review/active/` to `user-review/archive/`.

6. **Phase RL.6: Loop QA And Docs**
   Add tests, manual QA notes, and documentation for using the folder with external AI agents.

## Error Handling

- Reject review run IDs or paths that escape the target spec folder's `user-review/` root.
- If worktree mode is requested outside a Git repository, fail before writing a review run.
- If target source files have uncommitted changes, block worktree mode with a clear explanation.
- If the branch or worktree path already exists, fail with a clear conflict error.
- If `git worktree add` fails, do not write a partial review bundle.
- Treat missing active folders as recoverable list warnings.
- Preserve malformed review folders and report parse errors without deleting user data.
- If archive destination already exists, fail with a clear conflict error.
- If source Markdown changed after export, show a warning but allow archive.
- Never delete active review folders as part of archive; move them atomically when possible.

## Testing Plan

- Unit tests for review run ID validation and status transitions.
- Rust tests for path resolution and active/archive move behavior.
- Rust tests for Git repository detection, dirty target file detection, branch name generation, and worktree conflict handling.
- Rust tests for bundle rendering with file/spec scopes.
- TypeScript tests for review run IPC wrappers and UI states.
- Component tests for Japanese UI copy, create-review, active list, completed state, and archive confirmation.
- Manual QA with an external AI agent editing source Markdown in both current-workspace and worktree modes.

## Open Questions

- Should archive be manual only, or should the app offer auto-archive when `status.json` says `completed`?
- Should resolved comments be included by default, or should review runs default to open comments only?
- Should the app copy the active folder path to clipboard automatically after creation?
- Should `user-review/` be hidden from the spec tree by default, like other tool-owned folders?
- Should worktree mode be the default, or only an explicit safer option?
- Should later versions offer guarded worktree cleanup after archive?
- Should later versions support carrying uncommitted current-workspace changes into a review worktree?
- Should all existing English UI be migrated in one pass, or should the comment and user-review workflows come first?
