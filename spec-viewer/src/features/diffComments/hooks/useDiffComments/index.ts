import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DiffAnchorTarget,
  DiffCommentStatusFilter,
  DiffReviewIdentity,
  ResolvedDiffComment,
} from "@/features/diffComments/domain/diffComment";
import { diffCommentIdentityKey } from "@/features/diffComments/domain/diffComment";
import type {
  DiffCommentSession,
  DiffCommentSessionAction,
} from "@/features/diffComments/lib/diffCommentSession";
import { DiffCommentSessionState } from "@/features/diffComments/lib/diffCommentSession";
import type {
  DiffCommentCommandError,
  DiffCommentCommandName,
  DiffCommentCommands,
} from "@/lib/api/tauri";
import { diffCommentCommands as defaultCommands } from "@/lib/api/tauri";

export type CreateDiffCommentDraftInput = Readonly<{
  target: DiffAnchorTarget;
  commentId?: string;
  body?: string;
}>;

export type UpdateDiffCommentInput =
  | Readonly<{ commentId: string; body: string; resolved?: boolean }>
  | Readonly<{ commentId: string; body?: string; resolved: boolean }>
  | Readonly<{ commentId: string; replyBody: string }>
  | Readonly<{
      commentId: string;
      deleted: true;
      body?: never;
      resolved?: never;
    }>;

export type UseDiffCommentsOptions = Readonly<{
  identity: DiffReviewIdentity | null;
  commands?: DiffCommentCommands;
  onIdentityInvalidated?: () => void;
}>;

export type UseDiffCommentsResult = Readonly<{
  session: DiffCommentSession | null;
  comments: readonly ResolvedDiffComment[];
  error: DiffCommentCommandError | null;
  reload: () => Promise<boolean>;
  createDraft: (input: CreateDiffCommentDraftInput) => void;
  updateDraftBody: (body: string) => void;
  discardDraft: () => void;
  reanchorDraft: (target: DiffAnchorTarget) => void;
  setFilter: (filter: DiffCommentStatusFilter) => void;
  setSearch: (search: string) => void;
  selectComment: (commentId: string | null) => void;
  saveDraft: () => Promise<boolean>;
  updateComment: (input: UpdateDiffCommentInput) => Promise<boolean>;
  retry: () => Promise<boolean>;
}>;

type SessionMap = Readonly<Record<string, DiffCommentSession>>;
type RetryAction =
  | Readonly<{ kind: "draft" }>
  | Readonly<{ kind: "update"; input: UpdateDiffCommentInput }>;

type ErrorMap = Readonly<Record<string, DiffCommentCommandError | undefined>>;

/** @returns Whether a runtime document belongs to the command origin scope. */
function matchesDocumentScope(
  identity: DiffReviewIdentity,
  document: Readonly<{ repositoryId: string; worktreeId: string }>,
): boolean {
  return (
    identity.repositoryId === document.repositoryId &&
    identity.worktreeId === document.worktreeId
  );
}

/** @returns A stable error for an injected command crossing identity scopes. */
function scopeError(
  command: DiffCommentCommandName,
  raw: unknown,
): DiffCommentCommandError {
  return {
    command,
    code: "invalidResponse",
    message: "response document scope must match the request identity",
    raw,
  };
}

/** @returns A normalized gateway error for the hook boundary. */
function normalizeCommandError(
  command: DiffCommentCommandName,
  error: unknown,
): DiffCommentCommandError {
  if (
    typeof error === "object" &&
    error !== null &&
    "command" in error &&
    "code" in error &&
    "message" in error
  ) {
    return error as DiffCommentCommandError;
  }

  return {
    command,
    code: "unknown",
    message:
      error instanceof Error ? error.message : "Unknown Diff comment failure",
    raw: error,
  };
}

/** @returns Whether retrying requires a freshly loaded Diff identity. */
function invalidatesDiffIdentity(error: DiffCommentCommandError): boolean {
  return (
    error.code === "identityMismatch" ||
    error.code === "staleBase" ||
    error.code === "staleSnapshot"
  );
}

/** @returns Whether a comment is visible for controlled filter/search state. */
function isVisibleComment(
  comment: ResolvedDiffComment,
  filter: DiffCommentStatusFilter,
  normalizedSearch: string,
): boolean {
  const matchesFilter =
    filter === "all" ||
    (filter === "resolved" ? comment.resolved : !comment.resolved);
  if (!matchesFilter) {
    return false;
  }

  if (normalizedSearch.length === 0) {
    return true;
  }

  const path =
    comment.anchor.side === "base"
      ? comment.anchor.oldPath
      : comment.anchor.newPath;
  const replies = (comment.replies ?? []).map((reply) => reply.body).join("\n");
  return `${comment.body}\n${replies}\n${path}\n${comment.anchor.snippet}`
    .toLocaleLowerCase()
    .includes(normalizedSearch);
}

/** @returns Origin-aware Diff comment loading and mutation state. */
export function useDiffComments({
  identity: inputIdentity,
  commands = defaultCommands,
  onIdentityInvalidated,
}: UseDiffCommentsOptions): UseDiffCommentsResult {
  const repositoryId = inputIdentity?.repositoryId ?? null;
  const worktreeId = inputIdentity?.worktreeId ?? null;
  const baseSha = inputIdentity?.baseSha ?? null;
  const currentSnapshotId = inputIdentity?.currentSnapshotId ?? null;
  const identity = useMemo<DiffReviewIdentity | null>(() => {
    if (
      repositoryId === null ||
      worktreeId === null ||
      baseSha === null ||
      currentSnapshotId === null
    ) {
      return null;
    }

    return { repositoryId, worktreeId, baseSha, currentSnapshotId };
  }, [baseSha, currentSnapshotId, repositoryId, worktreeId]);
  const [sessions, setSessions] = useState<SessionMap>({});
  const sessionsRef = useRef(sessions);
  const previousIdentityRef = useRef<DiffReviewIdentity | null>(null);
  const loadGenerationRef = useRef(new Map<string, number>());
  const retryActionsRef = useRef(new Map<string, RetryAction>());
  const identityRecoveryKeysRef = useRef(new Set<string>());
  const automaticRetryKeysRef = useRef(new Set<string>());
  const mutationGenerationRef = useRef(new Map<string, number>());
  const mutationInFlightRef = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorMap>({});
  sessionsRef.current = sessions;

  const activeKey = identity === null ? null : diffCommentIdentityKey(identity);
  const activeSession =
    activeKey === null ? null : (sessions[activeKey] ?? null);
  const error = activeKey === null ? null : (errors[activeKey] ?? null);

  const dispatchTo = useCallback(
    (
      key: string,
      fallbackIdentity: DiffReviewIdentity,
      action: DiffCommentSessionAction,
    ): void => {
      setSessions((current) => {
        const previous =
          current[key] ?? DiffCommentSessionState.create(fallbackIdentity);
        return {
          ...current,
          [key]: DiffCommentSessionState.reduce(previous, action),
        };
      });
    },
    [],
  );

  const setErrorFor = useCallback(
    (key: string, nextError: DiffCommentCommandError | null): void => {
      setErrors((current) => ({
        ...current,
        [key]: nextError ?? undefined,
      }));
    },
    [],
  );

  const loadIdentity = useCallback(
    async (targetIdentity: DiffReviewIdentity): Promise<boolean> => {
      const key = diffCommentIdentityKey(targetIdentity);
      if (mutationInFlightRef.current.has(key)) {
        return false;
      }
      const generation = (loadGenerationRef.current.get(key) ?? 0) + 1;
      loadGenerationRef.current.set(key, generation);
      dispatchTo(key, targetIdentity, { type: "loading" });
      setErrorFor(key, null);

      try {
        const document = await commands.load({ identity: targetIdentity });
        if (!matchesDocumentScope(targetIdentity, document)) {
          throw scopeError("load_diff_comments", document);
        }
        if (loadGenerationRef.current.get(key) !== generation) {
          return false;
        }
        dispatchTo(key, targetIdentity, {
          type: "loaded",
          revision: document.revision,
          comments: document.comments,
          resolutionWarnings: document.resolutionWarnings,
        });
        return true;
      } catch (caught) {
        if (loadGenerationRef.current.get(key) !== generation) {
          return false;
        }
        dispatchTo(key, targetIdentity, { type: "loadFailed" });
        setErrorFor(key, normalizeCommandError("load_diff_comments", caught));
        return false;
      }
    },
    [commands, dispatchTo, setErrorFor],
  );

  useEffect(() => {
    const previousIdentity = previousIdentityRef.current;
    previousIdentityRef.current = identity;
    if (identity === null) {
      return;
    }

    const key = diffCommentIdentityKey(identity);
    if (previousIdentity !== null) {
      const previousKey = diffCommentIdentityKey(previousIdentity);
      if (previousKey !== key) {
        loadGenerationRef.current.set(
          previousKey,
          (loadGenerationRef.current.get(previousKey) ?? 0) + 1,
        );
      }
    }
    const previousKey =
      previousIdentity === null
        ? null
        : diffCommentIdentityKey(previousIdentity);
    const shouldRecoverDraft =
      previousKey !== null &&
      identityRecoveryKeysRef.current.delete(previousKey);
    if (shouldRecoverDraft && previousKey !== null) {
      const retryAction = retryActionsRef.current.get(previousKey);
      if (retryAction !== undefined) {
        retryActionsRef.current.delete(previousKey);
        retryActionsRef.current.set(key, retryAction);
        automaticRetryKeysRef.current.add(key);
      }
    }

    setSessions((current) => {
      if (current[key] !== undefined) {
        return current;
      }
      if (
        previousIdentity !== null &&
        previousIdentity.repositoryId === identity.repositoryId &&
        previousIdentity.worktreeId === identity.worktreeId
      ) {
        const previous =
          previousKey === null ? undefined : current[previousKey];
        if (previous !== undefined) {
          const switched = DiffCommentSessionState.switchIdentity(
            previous,
            identity,
          );
          return {
            ...current,
            [key]:
              shouldRecoverDraft && previous.draft !== null
                ? DiffCommentSessionState.reduce(switched, {
                    type: "draftReanchored",
                    target: previous.draft.target,
                  })
                : switched,
          };
        }
      }
      return { ...current, [key]: DiffCommentSessionState.create(identity) };
    });
    void loadIdentity(identity);
  }, [identity, loadIdentity]);

  const dispatchActive = useCallback(
    (action: DiffCommentSessionAction): void => {
      if (identity === null || activeKey === null) {
        return;
      }
      dispatchTo(activeKey, identity, action);
    },
    [activeKey, dispatchTo, identity],
  );

  const reload = useCallback(async (): Promise<boolean> => {
    return identity === null ? false : loadIdentity(identity);
  }, [identity, loadIdentity]);

  const createDraft = useCallback(
    (input: CreateDiffCommentDraftInput): void => {
      dispatchActive({ type: "draftCreated", ...input });
    },
    [dispatchActive],
  );
  const updateDraftBody = useCallback(
    (body: string): void => dispatchActive({ type: "draftBodyChanged", body }),
    [dispatchActive],
  );
  const discardDraft = useCallback(
    (): void => dispatchActive({ type: "draftDiscarded" }),
    [dispatchActive],
  );
  const reanchorDraft = useCallback(
    (target: DiffAnchorTarget): void =>
      dispatchActive({ type: "draftReanchored", target }),
    [dispatchActive],
  );
  const setFilter = useCallback(
    (filter: DiffCommentStatusFilter): void =>
      dispatchActive({ type: "filterChanged", filter }),
    [dispatchActive],
  );
  const setSearch = useCallback(
    (search: string): void => dispatchActive({ type: "searchChanged", search }),
    [dispatchActive],
  );
  const selectComment = useCallback(
    (commentId: string | null): void =>
      dispatchActive({ type: "commentSelected", commentId }),
    [dispatchActive],
  );

  const settle = useCallback(
    async (
      originIdentity: DiffReviewIdentity,
      command: "save_diff_comment" | "update_diff_comment",
      operation: () => ReturnType<DiffCommentCommands["save"]>,
    ): Promise<boolean> => {
      const originKey = diffCommentIdentityKey(originIdentity);
      if (mutationInFlightRef.current.has(originKey)) {
        return false;
      }

      const generation =
        (mutationGenerationRef.current.get(originKey) ?? 0) + 1;
      mutationGenerationRef.current.set(originKey, generation);
      mutationInFlightRef.current.add(originKey);
      loadGenerationRef.current.set(
        originKey,
        (loadGenerationRef.current.get(originKey) ?? 0) + 1,
      );
      dispatchTo(originKey, originIdentity, { type: "mutationStarted" });
      setErrorFor(originKey, null);
      try {
        const outcome = await operation();
        if (mutationGenerationRef.current.get(originKey) !== generation) {
          return false;
        }

        const document =
          outcome.kind === "committed"
            ? outcome.document
            : outcome.kind === "conflict"
              ? outcome.latestDocument
              : outcome.code === "revisionOverflow"
                ? outcome.currentDocument
                : null;
        if (
          document !== null &&
          !matchesDocumentScope(originIdentity, document)
        ) {
          throw scopeError(command, outcome);
        }

        dispatchTo(originKey, originIdentity, {
          type: "mutationSettled",
          outcome,
        });
        if (
          outcome.kind === "committed" ||
          (outcome.kind === "preCommitFailure" && !outcome.retryable)
        ) {
          retryActionsRef.current.delete(originKey);
        }
        return outcome.kind === "committed";
      } catch (caught) {
        if (mutationGenerationRef.current.get(originKey) !== generation) {
          return false;
        }
        const normalizedError = normalizeCommandError(command, caught);
        setErrorFor(originKey, normalizedError);
        dispatchTo(originKey, originIdentity, {
          type: "mutationTransportFailed",
        });
        if (
          invalidatesDiffIdentity(normalizedError) &&
          onIdentityInvalidated !== undefined
        ) {
          identityRecoveryKeysRef.current.add(originKey);
          onIdentityInvalidated();
        }
        return false;
      } finally {
        if (mutationGenerationRef.current.get(originKey) === generation) {
          mutationInFlightRef.current.delete(originKey);
        }
      }
    },
    [dispatchTo, onIdentityInvalidated, setErrorFor],
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (identity === null || activeKey === null) {
      return false;
    }
    const session = sessionsRef.current[activeKey];
    const draft = session?.draft;
    const normalizedBody = draft?.body.trim() ?? "";
    if (
      session === undefined ||
      draft === null ||
      session.writeBlockReason !== null ||
      !draft.canSubmit ||
      normalizedBody.length === 0
    ) {
      return false;
    }
    if (draft.commentId !== undefined) {
      retryActionsRef.current.set(activeKey, { kind: "draft" });
      return settle(identity, "update_diff_comment", () =>
        commands.update({
          identity,
          expectedRevision: session.revision,
          commentId: draft.commentId as string,
          body: normalizedBody,
        }),
      );
    }
    retryActionsRef.current.set(activeKey, { kind: "draft" });
    return settle(identity, "save_diff_comment", () =>
      commands.save({
        identity,
        expectedRevision: session.revision,
        target: draft.target,
        body: normalizedBody,
      }),
    );
  }, [activeKey, commands, identity, settle]);

  const updateComment = useCallback(
    async (input: UpdateDiffCommentInput): Promise<boolean> => {
      if (identity === null || activeKey === null) {
        return false;
      }
      const session = sessionsRef.current[activeKey];
      if (session === undefined || session.writeBlockReason !== null) {
        return false;
      }
      const normalizedInput: UpdateDiffCommentInput =
        "body" in input && input.body !== undefined
          ? { ...input, body: input.body.trim() }
          : "replyBody" in input
            ? { ...input, replyBody: input.replyBody.trim() }
            : input;
      const normalizedBody =
        "body" in normalizedInput
          ? normalizedInput.body
          : "replyBody" in normalizedInput
            ? normalizedInput.replyBody
            : undefined;
      if (normalizedBody !== undefined && normalizedBody.length === 0) {
        return false;
      }
      retryActionsRef.current.set(activeKey, {
        kind: "update",
        input: normalizedInput,
      });
      return settle(identity, "update_diff_comment", () =>
        commands.update({
          identity,
          expectedRevision: session.revision,
          ...normalizedInput,
        }),
      );
    },
    [activeKey, commands, identity, settle],
  );

  useEffect(() => {
    if (
      activeKey === null ||
      activeSession?.loadState !== "ready" ||
      !automaticRetryKeysRef.current.delete(activeKey)
    ) {
      return;
    }
    const retryAction = retryActionsRef.current.get(activeKey);
    if (retryAction === undefined) {
      return;
    }
    if (retryAction.kind === "draft") {
      void saveDraft();
      return;
    }
    void updateComment(retryAction.input);
  }, [activeKey, activeSession?.loadState, saveDraft, updateComment]);

  const comments = useMemo(() => {
    if (activeSession === null) {
      return [];
    }
    const normalizedSearch = activeSession.search.trim().toLocaleLowerCase();
    return activeSession.comments.filter((comment) =>
      isVisibleComment(comment, activeSession.filter, normalizedSearch),
    );
  }, [activeSession]);

  const retry = useCallback(async (): Promise<boolean> => {
    if (activeKey === null) {
      return false;
    }
    const action = retryActionsRef.current.get(activeKey);
    if (action === undefined) {
      return false;
    }
    return action.kind === "draft" ? saveDraft() : updateComment(action.input);
  }, [activeKey, saveDraft, updateComment]);

  return {
    session: activeSession,
    comments,
    error,
    reload,
    createDraft,
    updateDraftBody,
    discardDraft,
    reanchorDraft,
    setFilter,
    setSearch,
    selectComment,
    saveDraft,
    updateComment,
    retry,
  };
}
