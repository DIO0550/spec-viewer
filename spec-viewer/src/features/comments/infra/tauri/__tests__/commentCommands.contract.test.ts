import { expectTypeOf, test } from "vitest";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentCommandError } from "@/features/comments/domain/commentError";
import type {
  AddCommentCommandError,
  DeleteCommentCommandError,
  ExportCommentsCommandError,
  GenerateLlmPromptCommandError,
  ListCommentsCommandError,
  ReopenCommentCommandError,
  ResolveCommentCommandError,
  UpdateCommentCommandError,
} from "@/features/comments/infra/tauri";
import type { AddCommentRequest } from "@/features/comments/types/comment";
import type {
  AddCommentCommandRequest,
  AddCommentCommandResponse,
} from "@/features/comments/infra/tauri/addComment";

test("addCommentのper-command contractはcomment DTOと一致する", () => {
  expectTypeOf<AddCommentCommandRequest>().toEqualTypeOf<AddCommentRequest>();
  expectTypeOf<AddCommentCommandResponse>().toEqualTypeOf<Comment>();
});

test("comments公開APIはaddComment error型を同名exportとして公開する", () => {
  expectTypeOf<
    import("@/features/comments").AddCommentCommandError
  >().toEqualTypeOf<
    import("@/features/comments/infra/tauri/addComment").AddCommentCommandError
  >();
});

test("comment causeは既存command errorの判別可能unionを維持する", () => {
  expectTypeOf<CommentCommandError>().toEqualTypeOf<
    | AddCommentCommandError
    | DeleteCommentCommandError
    | ExportCommentsCommandError
    | GenerateLlmPromptCommandError
    | ListCommentsCommandError
    | ReopenCommentCommandError
    | ResolveCommentCommandError
    | UpdateCommentCommandError
  >();
});

test("add_commentのcauseはmarkdownReadを受け付けない", () => {
  expectTypeOf<
    Readonly<{
      command: "add_comment";
      code: "markdownRead";
      message: string;
      raw: unknown;
    }>
  >().not.toMatchTypeOf<CommentCommandError>();
});
