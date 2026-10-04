import { expectTypeOf, test } from "vitest";
import type { CommentStatusFilter as CommentStatusFilterType } from "@/features/comments/domain/commentStatusFilter";
import type {
  ApplyWithAiCommentSelectionInput,
  ApplyWithAiGeneratedDiffPreview,
  ApplyWithAiPlaceholderState,
  CommentAnchorDisplayStatus,
  CommentDisplayFilter,
  CommentDisplayState,
  CommentExportOperation,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
test("comment view modelは状態フィルターとorphan表示状態を共有できる", () => {
  expectTypeOf<CommentStatusFilterType>().toEqualTypeOf<
    "all" | "open" | "resolved"
  >();
  expectTypeOf<CommentDisplayFilter>().toEqualTypeOf<CommentStatusFilterType>();
  expectTypeOf<CommentDisplayFilter>().toEqualTypeOf<
    "all" | "open" | "resolved"
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
