export type {
  BaseDiffLineAnchor,
  CurrentDiffLineAnchor,
  DiffAnchorResolution,
  DiffAnchorTarget,
  DiffCommentMutationOutcome,
  DiffCommentDocumentScope,
  DiffCommentSide,
  DiffCommentStatusFilter,
  DiffLineAnchor,
  DiffReviewIdentity,
  ResolvedDiffComment,
  ResolvedDiffComments,
  ResolutionWarning,
  ResolutionWarningCode,
  StaleAnchorReason,
  StoredDiffComment,
  UnavailableReason,
} from "./domain/diffComment";
export {
  diffCommentIdentityKey,
  isCanonicalDiffCommentRevision,
} from "./domain/diffComment";
export type {
  DiffCommentDraft,
  DiffCommentDraftDisabledReason,
  DiffCommentMutationState,
  DiffCommentSession,
  DiffCommentSessionAction,
} from "./lib/diffCommentSession";
export { DiffCommentSessionState } from "./lib/diffCommentSession";
export type {
  CreateDiffCommentDraftInput,
  UpdateDiffCommentInput,
  UseDiffCommentsOptions,
  UseDiffCommentsResult,
} from "./hooks/useDiffComments";
export { useDiffComments } from "./hooks/useDiffComments";
