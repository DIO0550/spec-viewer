import type {
  DiffAnchorTarget,
  DiffCommentMutationOutcome,
  DiffCommentStatusFilter,
  DiffReviewIdentity,
  ResolvedDiffComment,
  ResolutionWarning,
} from "@/features/diffComments/domain/diffComment";
import { diffCommentIdentityKey } from "@/features/diffComments/domain/diffComment";

export type DiffCommentDraftDisabledReason =
  | "staleTarget"
  | "saving"
  | "revisionOverflow"
  | "permission"
  | "invalidStore";

export type DiffCommentDraft = Readonly<{
  state: "active" | "staleTarget";
  target: DiffAnchorTarget;
  commentId?: string;
  body: string;
  canSubmit: boolean;
  disabledReason: DiffCommentDraftDisabledReason | null;
}>;

export type DiffCommentMutationState =
  | Readonly<{ state: "idle" }>
  | Readonly<{ state: "saving" }>
  | Readonly<{
      state: "committed";
      durability: "durable" | "uncertain";
    }>
  | Readonly<{ state: "conflict" }>
  | Readonly<{ state: "transportFailure" }>
  | Readonly<{
      state: "preCommitFailure";
      code: DiffCommentMutationOutcome extends infer Outcome
        ? Outcome extends { kind: "preCommitFailure"; code: infer Code }
          ? Code
          : never
        : never;
      retryable: boolean;
    }>;

export type DiffCommentWriteBlockReason = Extract<
  DiffCommentDraftDisabledReason,
  "revisionOverflow" | "permission" | "invalidStore"
>;

export type DiffCommentSession = Readonly<{
  identity: DiffReviewIdentity;
  loadState: "idle" | "loading" | "ready" | "error";
  revision: string;
  comments: readonly ResolvedDiffComment[];
  resolutionWarnings: readonly ResolutionWarning[];
  filter: DiffCommentStatusFilter;
  search: string;
  selectedCommentId: string | null;
  draft: DiffCommentDraft | null;
  mutation: DiffCommentMutationState;
  writeBlockReason: DiffCommentWriteBlockReason | null;
}>;

export type DiffCommentSessionAction =
  | Readonly<{ type: "loading" }>
  | Readonly<{
      type: "loaded";
      revision: string;
      comments: readonly ResolvedDiffComment[];
      resolutionWarnings: readonly ResolutionWarning[];
    }>
  | Readonly<{ type: "loadFailed" }>
  | Readonly<{ type: "filterChanged"; filter: DiffCommentStatusFilter }>
  | Readonly<{ type: "searchChanged"; search: string }>
  | Readonly<{ type: "commentSelected"; commentId: string | null }>
  | Readonly<{
      type: "draftCreated";
      target: DiffAnchorTarget;
      commentId?: string;
      body?: string;
    }>
  | Readonly<{ type: "draftBodyChanged"; body: string }>
  | Readonly<{ type: "draftDiscarded" }>
  | Readonly<{ type: "draftReanchored"; target: DiffAnchorTarget }>
  | Readonly<{ type: "mutationStarted" }>
  | Readonly<{ type: "mutationTransportFailed" }>
  | Readonly<{
      type: "mutationSettled";
      outcome: DiffCommentMutationOutcome;
    }>;

/** @returns The initial state for one complete Diff identity. */
function create(identity: DiffReviewIdentity): DiffCommentSession {
  return {
    identity,
    loadState: "idle",
    revision: "0",
    comments: [],
    resolutionWarnings: [],
    filter: "all",
    search: "",
    selectedCommentId: null,
    draft: null,
    mutation: { state: "idle" },
    writeBlockReason: null,
  };
}

const MaxDiffCommentRevision = "18446744073709551615";

/** @returns The permanent write block implied by a successfully loaded revision. */
function writeBlockForRevision(
  revision: string,
): DiffCommentWriteBlockReason | null {
  return revision === MaxDiffCommentRevision ? "revisionOverflow" : null;
}

/** @returns A draft whose submit capability follows the document-level block. */
function applyWriteBlock(
  draft: DiffCommentDraft,
  writeBlockReason: DiffCommentWriteBlockReason | null,
): DiffCommentDraft {
  if (writeBlockReason === null) {
    return { ...draft, canSubmit: true, disabledReason: null };
  }

  return { ...draft, canSubmit: false, disabledReason: writeBlockReason };
}

/**
 * @param state - Previous identity state.
 * @param identity - Newly active complete identity.
 * @returns A fresh identity state with any unsent draft retained as stale.
 */
function switchIdentity(
  state: DiffCommentSession,
  identity: DiffReviewIdentity,
): DiffCommentSession {
  if (
    diffCommentIdentityKey(state.identity) === diffCommentIdentityKey(identity)
  ) {
    return state;
  }

  const next = create(identity);
  if (state.draft === null) {
    return next;
  }

  return {
    ...next,
    draft: {
      ...state.draft,
      state: "staleTarget",
      canSubmit: false,
      disabledReason: "staleTarget",
    },
  };
}

/**
 * @param state - Current session state.
 * @param outcome - Settled mutation outcome for this session.
 * @returns The reconciled session.
 */
function settleMutation(
  state: DiffCommentSession,
  outcome: DiffCommentMutationOutcome,
): DiffCommentSession {
  if (outcome.kind === "committed") {
    return {
      ...state,
      loadState: "ready",
      revision: outcome.document.revision,
      comments: outcome.document.comments,
      resolutionWarnings: outcome.document.resolutionWarnings,
      draft: null,
      mutation: { state: "committed", durability: outcome.durability },
      writeBlockReason: writeBlockForRevision(outcome.document.revision),
    };
  }

  if (outcome.kind === "conflict") {
    const writeBlockReason = writeBlockForRevision(
      outcome.latestDocument.revision,
    );
    return {
      ...state,
      loadState: "ready",
      revision: outcome.latestDocument.revision,
      comments: outcome.latestDocument.comments,
      resolutionWarnings: outcome.latestDocument.resolutionWarnings,
      draft:
        state.draft === null
          ? null
          : applyWriteBlock(state.draft, writeBlockReason),
      mutation: { state: "conflict" },
      writeBlockReason,
    };
  }

  if (outcome.code === "revisionOverflow") {
    return {
      ...state,
      loadState: "ready",
      revision: outcome.currentDocument.revision,
      comments: outcome.currentDocument.comments,
      resolutionWarnings: outcome.currentDocument.resolutionWarnings,
      draft:
        state.draft === null
          ? null
          : {
              ...state.draft,
              canSubmit: false,
              disabledReason: "revisionOverflow",
            },
      mutation: {
        state: "preCommitFailure",
        code: outcome.code,
        retryable: false,
      },
      writeBlockReason: "revisionOverflow",
    };
  }

  return {
    ...state,
    draft:
      state.draft === null
        ? null
        : {
            ...state.draft,
            canSubmit: outcome.retryable,
            disabledReason: outcome.retryable ? null : outcome.code,
          },
    mutation: {
      state: "preCommitFailure",
      code: outcome.code,
      retryable: outcome.retryable,
    },
    writeBlockReason: outcome.retryable ? state.writeBlockReason : outcome.code,
  };
}

/**
 * @param state - Current session state.
 * @param action - Domain action.
 * @returns The next immutable state.
 */
function reduce(
  state: DiffCommentSession,
  action: DiffCommentSessionAction,
): DiffCommentSession {
  switch (action.type) {
    case "loading":
      return { ...state, loadState: "loading" };
    case "loaded": {
      const writeBlockReason = writeBlockForRevision(action.revision);
      return {
        ...state,
        loadState: "ready",
        revision: action.revision,
        comments: action.comments,
        resolutionWarnings: action.resolutionWarnings,
        draft:
          state.draft === null || state.draft.state === "staleTarget"
            ? state.draft
            : applyWriteBlock(state.draft, writeBlockReason),
        writeBlockReason,
      };
    }
    case "loadFailed":
      return { ...state, loadState: "error" };
    case "filterChanged":
      return { ...state, filter: action.filter };
    case "searchChanged":
      return { ...state, search: action.search };
    case "commentSelected":
      return { ...state, selectedCommentId: action.commentId };
    case "draftCreated":
      return {
        ...state,
        draft: applyWriteBlock(
          {
            state: "active",
            target: action.target,
            commentId: action.commentId,
            body: action.body ?? "",
            canSubmit: true,
            disabledReason: null,
          },
          state.writeBlockReason,
        ),
      };
    case "draftBodyChanged":
      return state.draft === null
        ? state
        : { ...state, draft: { ...state.draft, body: action.body } };
    case "draftDiscarded":
      return { ...state, draft: null };
    case "draftReanchored":
      return state.draft === null
        ? state
        : {
            ...state,
            draft: applyWriteBlock(
              {
                ...state.draft,
                state: "active",
                target: action.target,
                canSubmit: true,
                disabledReason: null,
              },
              state.writeBlockReason,
            ),
          };
    case "mutationStarted":
      return {
        ...state,
        draft:
          state.draft === null
            ? null
            : {
                ...state.draft,
                canSubmit: false,
                disabledReason: "saving",
              },
        mutation: { state: "saving" },
      };
    case "mutationTransportFailed":
      return {
        ...state,
        draft:
          state.draft === null
            ? null
            : { ...state.draft, canSubmit: true, disabledReason: null },
        mutation: { state: "transportFailure" },
      };
    case "mutationSettled":
      return settleMutation(state, action.outcome);
  }
}

export const DiffCommentSessionState = {
  create,
  reduce,
  switchIdentity,
} as const;
