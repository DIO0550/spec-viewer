import type { Comment, CommentStatusRequest } from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns The comment after reopening it. */
export async function reopenComment(
  request: CommentStatusRequest,
): Promise<Comment> {
  return invokeTauriCommand("reopen_comment", request);
}
