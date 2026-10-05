import { CommentThread } from "@/features/comments/components/CommentThread";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentId } from "@/features/comments/domain/commentId";
import type { CommentOperationState } from "@/features/comments/domain/commentOperation";
import type { CommentAnchorDisplayStatus } from "@/features/comments/types/comment";

export type CommentSectionActions = Readonly<{
  /**
   * 指定したコメントを選択する。
   * @param commentId - 選択するコメントの ID。
   */
  onSelectComment: (commentId: CommentId) => void;
  /**
   * 指定したコメントを解決済みにする。
   * @param commentId - 解決済みにするコメントの ID。
   */
  onResolveComment: (commentId: CommentId) => void;
  /**
   * 指定した解決済みコメントを未解決に戻す。
   * @param commentId - 未解決に戻すコメントの ID。
   */
  onReopenComment: (commentId: CommentId) => void;
  /**
   * 指定したコメントを削除する。
   * @param commentId - 削除するコメントの ID。
   */
  onDeleteComment: (commentId: CommentId) => void;
  /**
   * 指定したコメントの本文を更新する。
   * @param commentId - 更新するコメントの ID。
   * @param body - 更新後のコメント本文。
   */
  onUpdateComment: (commentId: CommentId, body: string) => void;
}>;

type SectionProps = Readonly<{
  id: string;
  title: string;
  comments: readonly Comment[];
  activeCommentId: CommentId | null;
  anchorDisplayStatusByCommentId: ReadonlyMap<
    CommentId,
    CommentAnchorDisplayStatus
  >;
  searchQuery: string;
  operationState: CommentOperationState;
  emptyMessage: string;
  actions: CommentSectionActions;
}>;

/** @returns 件数バッジを含む、グループ化されたコメントのセクション。 */
export function CommentSection({
  id,
  title,
  comments,
  activeCommentId,
  anchorDisplayStatusByCommentId,
  searchQuery,
  operationState,
  emptyMessage,
  actions,
}: SectionProps) {
  return (
    <section className="comment-sidebar__section" aria-labelledby={id}>
      <div className="comment-sidebar__section-header">
        <h3 id={id}>{title}</h3>
        <span title={`${title} comment count`}>{comments.length}</span>
      </div>
      {comments.length === 0 ? (
        <p className="comment-sidebar__section-empty">{emptyMessage}</p>
      ) : (
        <ul className="comment-sidebar__list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentThread
                comment={comment}
                isActive={comment.id === activeCommentId}
                anchorDisplayStatus={
                  anchorDisplayStatusByCommentId.get(comment.id) ?? "exact"
                }
                searchQuery={searchQuery}
                operationState={operationState}
                {...actions}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
