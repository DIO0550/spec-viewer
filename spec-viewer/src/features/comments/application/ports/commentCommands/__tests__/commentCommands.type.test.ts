import { expectTypeOf, test } from "vitest";

import type { CommentBody } from "@/features/comments/domain/commentBody";
import type {
  AddCommentRequest,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";

test("comment add/update application requestはvalidated CommentBodyを要求する", () => {
  expectTypeOf<AddCommentRequest["body"]>().toEqualTypeOf<CommentBody>();
  expectTypeOf<UpdateCommentRequest["body"]>().toEqualTypeOf<CommentBody>();
});

test("validated CommentBodyはraw draft stringと代入互換ではない", () => {
  expectTypeOf<string>().not.toMatchTypeOf<CommentBody>();
});
