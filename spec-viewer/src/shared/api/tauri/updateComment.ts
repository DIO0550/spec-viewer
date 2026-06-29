import type { Comment, UpdateCommentRequest } from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns The updated comment after replacing its body. */
export async function updateComment(
  request: UpdateCommentRequest,
): Promise<Comment> {
  return invokeTauriCommand("update_comment", request);
}
