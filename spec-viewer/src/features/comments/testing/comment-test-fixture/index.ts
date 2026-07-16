import {
  Comment,
  type Comment as CommentType,
  type CommentAnchorResolution,
} from "@/features/comments/domain/comment";
import type { CommentAnchor } from "@/features/comments/domain/commentAnchor";
import { CommentBody } from "@/features/comments/domain/commentBody";
import type { CommentStatus } from "@/features/comments/domain/commentStatusFilter";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { CommentId } from "@/shared/domain/commentId";
import { IsoDateTime } from "@/shared/domain/isoDateTime";

export type CommentTestFixtureInput = Readonly<{
  id?: string;
  anchor?: CommentAnchor;
  body?: string;
  status?: CommentStatus;
  anchorResolution?: CommentAnchorResolution | null;
  createdAt?: string;
  updatedAt?: string;
}>;

const defaultCreatedAt = "2026-05-05T10:00:00Z";

/**
 * @param input - Optional raw fixture overrides validated by production factories.
 * @returns A valid Comment aggregate for tests and stories.
 * @throws Error when an override violates a production invariant.
 */
export function createCommentTestFixture(
  input: CommentTestFixtureInput = {},
): CommentType {
  const id = CommentId.fromDto(input.id ?? "cmt_1");
  if (!id.ok) {
    throw new Error(id.error.message);
  }

  const body = CommentBody.parse(input.body ?? "Clarify this task");
  if (!body.ok) {
    throw new Error("Comment fixture body must be non-blank");
  }

  const createdAt = IsoDateTime.fromDto(input.createdAt ?? defaultCreatedAt);
  if (!createdAt.ok) {
    throw new Error(createdAt.error.message);
  }

  const updatedAt = IsoDateTime.fromDto(
    input.updatedAt ?? input.createdAt ?? defaultCreatedAt,
  );
  if (!updatedAt.ok) {
    throw new Error(updatedAt.error.message);
  }

  const restored = Comment.restore({
    id: id.value,
    anchor:
      input.anchor ??
      createCommentAnchorTestFixture({
        fileKey: "tasks",
        blockType: "paragraph",
        blockIndex: 0,
        textHash: "sha256:f1a57001",
        textSnippet: "Clarify this task",
        charRange: { start: 0, end: 18 },
      }),
    body: body.commentBody,
    status: input.status ?? "open",
    anchorResolution: input.anchorResolution ?? null,
    createdAt: createdAt.value,
    updatedAt: updatedAt.value,
  });

  if (!restored.ok) {
    throw new Error(restored.error.reason);
  }

  return restored.value;
}
