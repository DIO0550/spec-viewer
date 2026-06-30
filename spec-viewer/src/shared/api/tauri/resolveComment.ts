import type { Comment, CommentStatusRequest } from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns The comment after marking it resolved. */
export async function resolveComment(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeTauriCommand("resolve_comment", request);
}
