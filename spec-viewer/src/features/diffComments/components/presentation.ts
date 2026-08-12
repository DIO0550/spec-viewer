import type {
  DiffAnchorTarget,
  DiffAnchorResolution,
  ResolvedDiffComment,
  UseDiffCommentsResult,
} from "@/features/diffComments";
import type {
  DiffLineCommentSummary,
  DiffLineCommentTarget,
} from "@/features/diffComments/components/DiffLineCommentControl";
import type { DiffLineCommentsController } from "@/features/diffComments/components/DiffLineCommentSlot";
import type {
  DiffReviewComment,
  DiffReviewResolution,
} from "@/features/diffComments/components/DiffReviewSidebar";

export type DiffCommentPresentationOptions = Readonly<{
  state: UseDiffCommentsResult;
  origin: HTMLButtonElement | null;
  onOriginChange: (origin: HTMLButtonElement | null) => void;
  onRevealComment: () => void;
  commentsByTarget?: Readonly<
    Record<string, readonly DiffLineCommentSummary[] | undefined>
  >;
}>;

/** Adapts the production session to the three viewers' line-control contract. */
export function createDiffLineCommentsController(
  options: DiffCommentPresentationOptions,
): DiffLineCommentsController {
  const session = options.state.session;
  const mutation = session?.mutation ?? { state: "idle" as const };
  const draft = session?.draft ?? null;

  return {
    commentsByTarget:
      options.commentsByTarget ??
      groupCommentsByResolvedTarget(session?.comments ?? []),
    activeCommentId: session?.selectedCommentId ?? null,
    draft:
      draft === null
        ? null
        : {
            target: toLineTarget(draft.target),
            body: draft.body,
            isSaving: mutation.state === "saving",
            canSubmit: draft.canSubmit,
            disabledReason: draft.disabledReason,
            canRetry:
              mutation.state === "transportFailure" ||
              (mutation.state === "preCommitFailure" && mutation.retryable),
            canReanchor: draft.state === "staleTarget",
            isDurabilityUncertain: false,
            origin: options.origin,
            statusMessage: getMutationStatus(mutation.state),
            errorMessage:
              options.state.error?.message ?? getMutationError(mutation),
          },
    onStartDraft: (target, origin) => {
      options.onOriginChange(origin);
      options.state.createDraft({ target: toAnchorTarget(target) });
    },
    onDraftBodyChange: options.state.updateDraftBody,
    onCancelDraft: () => {
      options.state.discardDraft();
      options.onOriginChange(null);
    },
    onSubmitDraft: () => {
      void options.state.saveDraft();
    },
    onRetryDraft: () => {
      void options.state.retry();
    },
    onReanchorDraft: (target) => {
      options.state.reanchorDraft(toAnchorTarget(target));
    },
    onSelectComment: (commentId) => {
      options.state.setFilter("all");
      options.state.setSearch("");
      options.state.selectComment(commentId);
      options.onRevealComment();
    },
  };
}

/** Adapts resolved domain comments to the controlled Review sidebar model. */
export function toDiffReviewComments(
  comments: readonly ResolvedDiffComment[],
): readonly DiffReviewComment[] {
  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    status: comment.resolved ? "resolved" : "open",
    locationLabel: formatLocation(comment),
    snippet: comment.anchor.snippet,
    resolution: toDiffReviewResolution(comment.anchorResolution),
  }));
}

function toDiffReviewResolution(
  resolution: DiffAnchorResolution,
): DiffReviewResolution {
  if (resolution.status === "exact" || resolution.status === "relocated") {
    return {
      status: resolution.status,
      selectionPath: resolution.selectionPath,
      sidePath: resolution.sidePath,
      side: resolution.side,
      line: resolution.line,
    };
  }
  if (resolution.status === "stale") {
    return { status: "stale", reason: resolution.reason };
  }
  if (resolution.status === "unavailable") {
    return { status: "unavailable", reason: resolution.reason };
  }
  return { status: "exact" };
}

/** Converts the line-control target to the command boundary target. */
export function toAnchorTarget(
  target: DiffLineCommentTarget,
): DiffAnchorTarget {
  if (target.side === "base") {
    return {
      side: "base",
      oldPath: target.oldPath ?? target.sidePath,
      newPath: target.newPath,
      line: target.line,
    };
  }
  return {
    side: "current",
    oldPath: target.oldPath,
    newPath: target.newPath ?? target.sidePath,
    line: target.line,
  };
}

export function groupCommentsByResolvedTarget(
  comments: readonly ResolvedDiffComment[],
): Readonly<Record<string, readonly DiffLineCommentSummary[] | undefined>> {
  const groups: Record<string, DiffLineCommentSummary[]> = {};
  for (const comment of comments) {
    const resolution = comment.anchorResolution;
    if (resolution.status !== "exact" && resolution.status !== "relocated") {
      continue;
    }
    const key = `${resolution.side}:${resolution.sidePath}:${resolution.line}`;
    const summary = {
      id: comment.id,
      createdAt: comment.createdAt,
      label: comment.body,
    };
    (groups[key] ??= []).push(summary);
  }
  return groups;
}

function toLineTarget(target: DiffAnchorTarget): DiffLineCommentTarget {
  const sidePath = target.side === "base" ? target.oldPath : target.newPath;
  return {
    key: `${target.side}:${sidePath}:${target.line}`,
    side: target.side,
    sidePath,
    oldPath: target.oldPath,
    newPath: target.newPath,
    line: target.line,
  };
}

function formatLocation(comment: ResolvedDiffComment): string {
  const path =
    comment.anchor.side === "base"
      ? comment.anchor.oldPath
      : comment.anchor.newPath;
  return `${path} ${comment.anchor.side} ${comment.anchor.line}行目`;
}

function getMutationStatus(state: string): string | null {
  if (state === "committed") {
    return "コメントを保存しました";
  }
  return null;
}

function getMutationError(
  mutation: NonNullable<UseDiffCommentsResult["session"]>["mutation"],
): string | null {
  if (mutation.state === "conflict") {
    return "他の更新と競合しました。入力内容を保持しています。";
  }
  if (mutation.state === "transportFailure") {
    return "通信に失敗しました。入力内容を保持しています。";
  }
  if (mutation.state === "preCommitFailure" && mutation.retryable) {
    return "保存できませんでした。入力内容を保持しています。";
  }
  return null;
}
