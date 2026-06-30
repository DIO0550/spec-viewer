import type { AddCommentRequest, Comment } from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns The newly persisted comment. */
export async function addComment(request: AddCommentRequest): Promise<Comment> {
  return invokeTauriCommand("add_comment", request);
}
