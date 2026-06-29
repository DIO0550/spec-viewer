import type { Comment, CommentStatusRequest } from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns The comment after toggling its resolved status. */
export async function toggleCommentResolved(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeTauriCommand("toggle_comment_resolved", request);
}
