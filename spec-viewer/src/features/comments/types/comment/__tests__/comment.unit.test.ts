import { expectTypeOf, test } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentStatusFilter as CommentStatusFilterType } from "@/features/comments/domain/commentStatusFilter";
import type {
  AddCommentRequest,
  ApplyWithAiCommentSelectionInput,
  ApplyWithAiGeneratedDiffPreview,
  ApplyWithAiPlaceholderState,
  CommentAnchorDisplayStatus,
  CommentDisplayFilter,
  CommentDisplayState,
  CommentExportOperation,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
import type {
  CreateUserReviewRequest,
  ReviewBundleManifest,
  ReviewBundleStatusDocument,
  UserReview,
} from "@/features/review-runs/types/userReviewIpc";
import type {
  AddCommentCommandRequest,
  AddCommentCommandResponse,
} from "@/shared/api/tauri/addComment";

test("addCommentのper-command contractはcomment DTOと一致する", () => {
  expectTypeOf<AddCommentCommandRequest>().toEqualTypeOf<AddCommentRequest>();
  expectTypeOf<AddCommentCommandResponse>().toEqualTypeOf<Comment>();
});

test("tauri barrelはaddComment error型を同名exportとして公開する", () => {
  expectTypeOf<
    import("@/shared/api/tauri").AddCommentCommandError
  >().toEqualTypeOf<
    import("@/shared/api/tauri/addComment").AddCommentCommandError
  >();
});

test("comment view modelは状態フィルターとorphan表示状態を共有できる", () => {
  expectTypeOf<CommentStatusFilterType>().toEqualTypeOf<
    "all" | "open" | "resolved"
  >();
  expectTypeOf<CommentStatusFilterType>().toMatchTypeOf<CommentDisplayFilter>();
  expectTypeOf<CommentDisplayFilter>().toEqualTypeOf<
    "all" | "open" | "resolved" | "moved" | "fuzzy" | "stale" | "orphaned"
  >();
  expectTypeOf<CommentDisplayState>().toEqualTypeOf<
    "open" | "resolved" | "orphaned"
  >();
  expectTypeOf<CommentAnchorDisplayStatus>().toEqualTypeOf<
    "exact" | "moved" | "fuzzy" | "orphaned" | "stale"
  >();
});

test("apply with AI placeholderは選択コメント入力と確認必須diff previewを表現する", () => {
  expectTypeOf<ApplyWithAiCommentSelectionInput>().toMatchTypeOf<{
    workspacePath: string;
    target: {
      scope: "file" | "spec" | "workspace";
    };
    commentIds: readonly string[];
  }>();
  expectTypeOf<ApplyWithAiGeneratedDiffPreview>().toMatchTypeOf<
    | {
        status: "notGenerated";
      }
    | {
        status: "ready";
        requiresExplicitConfirmation: true;
      }
  >();
  expectTypeOf<ApplyWithAiPlaceholderState>().toMatchTypeOf<{
    enabled: false;
    requiresExplicitUserConfirmationBeforeWrite: true;
  }>();
});

test("MCP feedback pathはdry-run payloadとmanual copy operationを表現する", () => {
  expectTypeOf<CommentExportOperation>().toEqualTypeOf<
    "file" | "spec" | "workspace" | "mcpFeedback"
  >();
  expectTypeOf<SpecSkillMcpFeedbackPayload>().toMatchTypeOf<{
    schemaVersion: "spec-reviewer.mcp-feedback.v1";
    mode: "dryRun";
    interface: {
      protocol: "mcp";
      serverName: "spec-skill";
      toolName: "spec_skill.feedback.submit";
      transport: "manual-copy";
    };
    dryRun: {
      callProvider: false;
      writeMarkdown: false;
    };
  }>();
});

test("review run payloadはfile/spec targetと実行先を表現する", () => {
  expectTypeOf<UserReview>().toMatchTypeOf<{
    status: "active" | "inProgress" | "completed" | "archived";
    workspace:
      | { mode: "currentWorkspace"; workspacePath: string }
      | {
          mode: "worktree";
          repositoryPath: string;
          worktreePath: string;
          branchName: string;
        };
  }>();
  expectTypeOf<CreateUserReviewRequest>().toMatchTypeOf<{
    target:
      | { scope: "file"; specId: string }
      | { scope: "spec"; specId: string };
    workspaceMode: "currentWorkspace" | "worktree";
  }>();
});

test("review run manifestとstatus documentはbundle schemaを表現する", () => {
  expectTypeOf<ReviewBundleManifest>().toMatchTypeOf<{
    schemaVersion: "spec-reviewer.review-run.v1";
    commentIds: readonly string[];
    archivedAt: string | null;
  }>();
  expectTypeOf<ReviewBundleStatusDocument>().toMatchTypeOf<{
    status: "active" | "inProgress" | "completed" | "archived";
    summary: string | null;
    warnings: readonly string[];
  }>();
});
