import type {
  CommentOperationKind,
  CommentOperationState,
} from "@/features/comments/domain/commentOperation";
import type { CommentId } from "@/features/comments/types/comment";
import { uiText } from "@/shared/lib/uiText";

export const emptyEditBodyMessage = uiText.commentThread.emptyBody;
export const failedUpdateMessage =
  "コメントを更新できませんでした。再試行してください。";
export const failedStatusActionMessage =
  "コメントの状態を変更できませんでした。再試行してください。";
export const failedDeleteMessage =
  "コメントを削除できませんでした。再試行してください。";

/**
 * @param operationState - Latest comment operation state
 * @param commentId - Comment shown in the edit dialog
 * @param operations - Operations whose failures should surface in the dialog
 * @returns Operation error message scoped to one comment and selected operations.
 */
export function getCommentOperationErrorMessage(
  operationState: CommentOperationState,
  commentId: CommentId,
  operations: readonly CommentOperationKind[],
): string | null {
  if (operationState.status !== "error") {
    return null;
  }

  if (operationState.commentId !== commentId) {
    return null;
  }

  if (!operations.includes(operationState.operation)) {
    return null;
  }

  return operationState.error.message;
}

/**
 * @param blockType - Persisted anchor block type
 * @returns Human-readable block type text for the edit anchor preview.
 */
export function formatEditBlockType(blockType: string): string {
  return blockType.replace(/_/g, " ");
}
