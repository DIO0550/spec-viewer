import type {
  DeleteCommentRequest,
  DeleteCommentResponse,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Delete confirmation for the requested comment. */
export async function deleteComment(
  request: DeleteCommentRequest,
): Promise<DeleteCommentResponse> {
  return invokeTauriCommand("delete_comment", request);
}
