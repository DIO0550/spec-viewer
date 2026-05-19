import { expectTypeOf, test } from "vitest";

import type { CommandRequest, CommandResponse } from "@/shared/types/ipc";
import { CommentStatusFilter } from "@/features/comments/types/comment";
import type {
  AddCommentRequest,
  ApplyWithAiCommentSelectionInput,
  ApplyWithAiGeneratedDiffPreview,
  ApplyWithAiPlaceholderState,
  Comment,
  CommentAnchorDisplayStatus,
  CommentExportOperation,
  CommentDisplayFilter,
  CommentDisplayState,
  CommentStatusFilter as CommentStatusFilterType,
  ListCommentsResponse,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
import type {
  CreateReviewRunRequest,
  ReviewRun,
  ReviewRunManifest,
  ReviewRunStatusDocument,
} from "@/features/review-runs/types/reviewRun";

test("comment command payloadsはP2.8 DTOと一致する", () => {
  expectTypeOf<
    CommandRequest<"add_comment">
  >().toEqualTypeOf<AddCommentRequest>();
  expectTypeOf<
    CommandResponse<"list_comments">
  >().toEqualTypeOf<ListCommentsResponse>();
  expectTypeOf<
    CommandResponse<"toggle_comment_resolved">
  >().toEqualTypeOf<Comment>();
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

test("CommentStatusFilter valuesはIPC互換の順序で列挙される", () => {
  expect(CommentStatusFilter.values).toEqual(["all", "open", "resolved"]);
});

test.each([
  ["all", "all"],
  ["open", "open"],
  ["resolved", "resolved"],
  [null, "all"],
  [undefined, "all"],
] as const)(
  "CommentStatusFilter.parseは%jを%sへ正規化する",
  (value, expected) => {
    expect(CommentStatusFilter.parse(value)).toBe(expected);
  },
);

test.each([
  ["closed"],
  [{ status: "open" }],
] as const)("CommentStatusFilter.parseは不正な入力%jをnullにする", (value) => {
  expect(CommentStatusFilter.parse(value)).toBeNull();
});

test.each(["all", "open", "resolved"] as const)(
  "CommentStatusFilter.isは有効な入力%sをtrueにする",
  (value) => {
    expect(CommentStatusFilter.is(value)).toBe(true);
  },
);

test.each([null, undefined, "closed"] as const)(
  "CommentStatusFilter.isは無効な入力%jをfalseにする",
  (value) => {
    expect(CommentStatusFilter.is(value)).toBe(false);
  },
);

test.each(["all", "open", "resolved"] as const)(
  "CommentStatusFilter.toStringは%sを同じ文字列として返す",
  (filter) => {
    expect(CommentStatusFilter.toString(filter)).toBe(filter);
  },
);

test.each([
  ["all", "open", true],
  ["all", "resolved", true],
  ["open", "open", true],
  ["open", "resolved", false],
  ["resolved", "open", false],
  ["resolved", "resolved", true],
] as const)(
  "CommentStatusFilter.matchesは%s filterと%s statusの一致を%jで返す",
  (filter, status, expected) => {
    expect(CommentStatusFilter.matches(filter, status)).toBe(expected);
  },
);

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
  expectTypeOf<
    CommandRequest<"create_review_run">
  >().toEqualTypeOf<CreateReviewRunRequest>();
  expectTypeOf<ReviewRun>().toMatchTypeOf<{
    status: "active" | "inProgress" | "completed" | "archived";
    executionTarget:
      | { mode: "currentWorkspace"; workspacePath: string }
      | {
          mode: "worktree";
          repositoryPath: string;
          worktreePath: string;
          branchName: string;
        };
  }>();
  expectTypeOf<CreateReviewRunRequest>().toMatchTypeOf<{
    target:
      | { scope: "file"; specId: string }
      | { scope: "spec"; specId: string };
    executionMode: "currentWorkspace" | "worktree";
  }>();
});

test("review run manifestとstatus documentはbundle schemaを表現する", () => {
  expectTypeOf<ReviewRunManifest>().toMatchTypeOf<{
    schemaVersion: "spec-reviewer.review-run.v1";
    commentIds: readonly string[];
    archivedAt: string | null;
  }>();
  expectTypeOf<ReviewRunStatusDocument>().toMatchTypeOf<{
    status: "active" | "inProgress" | "completed" | "archived";
    summary: string | null;
    warnings: readonly string[];
  }>();
});
