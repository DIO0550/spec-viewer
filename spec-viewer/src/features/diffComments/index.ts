export type {
  BaseDiffLineAnchor,
  CurrentDiffLineAnchor,
  DiffAnchorResolution,
  DiffAnchorTarget,
  DiffCommentDocumentScope,
  DiffCommentMutationOutcome,
  DiffCommentReply,
  DiffCommentSide,
  DiffCommentStatusFilter,
  DiffLineAnchor,
  ResolutionWarning,
  ResolutionWarningCode,
  ResolvedDiffComment,
  ResolvedDiffComments,
  StaleAnchorReason,
  StoredDiffComment,
  UnavailableReason,
} from "./domain/diffComment";
export { DiffReviewIdentity, DiffCommentRevision } from "./domain/diffComment";
export type {
  CreateDiffCommentDraftInput,
  UpdateDiffCommentInput,
  UseDiffCommentsOptions,
  UseDiffCommentsResult,
} from "./hooks/useDiffComments";
export { useDiffComments } from "./hooks/useDiffComments";
export type {
  DiffCommentDraft,
  DiffCommentDraftDisabledReason,
  DiffCommentMutationState,
  DiffCommentSession,
  DiffCommentSessionAction,
} from "./lib/diffCommentSession";
export { DiffCommentSessionState } from "./lib/diffCommentSession";

export type {
  DiffCommentBackendErrorCode,
  DiffCommentCommandError,
  DiffCommentCommandErrorCode,
  DiffCommentCommandName,
  DiffCommentCommands,
  LoadDiffCommentsRequest,
  SaveDiffCommentRequest,
  UpdateDiffCommentRequest,
} from "./infra/tauri/diffComments";
export {
  LOAD_DIFF_COMMENTS_COMMAND,
  SAVE_DIFF_COMMENT_COMMAND,
  UPDATE_DIFF_COMMENT_COMMAND,
  diffCommentCommands,
  getDiffReviewIdentity,
  loadDiffComments,
  saveDiffComment,
  updateDiffComment,
} from "./infra/tauri/diffComments";
export {
  InvalidDiffCommentResponseError,
  decodeDiffCommentDocument,
  decodeDiffCommentMutationOutcome,
  decodeDiffCommentRevision,
  decodeDiffReviewIdentity,
} from "./infra/tauri/diffCommentDecoder";
