import { expectTypeOf, test } from "vitest";

import type { CommandRequest, CommandResponse } from "./ipc";
import type {
  AddCommentRequest,
  ApplyWithAiCommentSelectionInput,
  ApplyWithAiGeneratedDiffPreview,
  ApplyWithAiPlaceholderState,
  Comment,
  CommentAnchorDisplayStatus,
  CommentDisplayFilter,
  CommentDisplayState,
  CommentStatusFilter,
  ListCommentsResponse,
} from "./comment";

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
  expectTypeOf<CommentStatusFilter>().toEqualTypeOf<
    "all" | "open" | "resolved"
  >();
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
