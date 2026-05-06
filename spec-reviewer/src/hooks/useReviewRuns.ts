import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  normalizeCommandError,
  reviewRunCommands as defaultReviewRunCommands,
  type ReviewRunCommands,
} from "../lib/tauri";
import type { CommentId } from "../types/comment";
import type { NormalizedCommandError } from "../types/ipc";
import type {
  CreateReviewRunRequest,
  ReviewRun,
  ReviewRunExecutionMode,
  ReviewRunTarget,
} from "../types/reviewRun";
import type { SpecFileKey } from "../types/spec";

export type ReviewRunTargetScope = "file" | "spec";

export type ReviewRunListState =
  | Readonly<{
      status: "idle";
      target: null;
      active: readonly [];
      archived: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "loading";
      target: ReviewRunTarget;
      active: readonly [];
      archived: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "ready";
      target: ReviewRunTarget;
      active: readonly ReviewRun[];
      archived: readonly ReviewRun[];
      error: null;
    }>
  | Readonly<{
      status: "empty";
      target: ReviewRunTarget;
      active: readonly [];
      archived: readonly [];
      error: null;
    }>
  | Readonly<{
      status: "error";
      target: ReviewRunTarget;
      active: readonly [];
      archived: readonly [];
      error: NormalizedCommandError;
    }>;

export type ReviewRunCreateState =
  | Readonly<{
      status: "idle";
      reviewRun: null;
      error: null;
    }>
  | Readonly<{
      status: "saving";
      reviewRun: null;
      error: null;
    }>
  | Readonly<{
      status: "success";
      reviewRun: ReviewRun;
      error: null;
    }>
  | Readonly<{
      status: "error";
      reviewRun: null;
      error: NormalizedCommandError;
    }>;

export type CreateReviewRunInput = Readonly<{
  commentIds: readonly CommentId[];
  executionMode: ReviewRunExecutionMode;
}>;

export type UseReviewRunsOptions = Readonly<{
  workspacePath: string | null;
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: ReviewRunTargetScope;
  commands?: ReviewRunCommands;
}>;

export type UseReviewRunsResult = Readonly<{
  target: ReviewRunTarget | null;
  listState: ReviewRunListState;
  createState: ReviewRunCreateState;
  activeRuns: readonly ReviewRun[];
  reloadReviewRuns: () => Promise<boolean>;
  createReviewRun: (input: CreateReviewRunInput) => Promise<ReviewRun | null>;
}>;

const idleListState: ReviewRunListState = {
  status: "idle",
  target: null,
  active: [],
  archived: [],
  error: null,
};

const idleCreateState: ReviewRunCreateState = {
  status: "idle",
  reviewRun: null,
  error: null,
};

/** @returns Review run loading and creation state for the selected target. */
export function useReviewRuns(
  options: UseReviewRunsOptions,
): UseReviewRunsResult {
  const commands = options.commands ?? defaultReviewRunCommands;
  const target = useMemo(
    () =>
      createReviewRunTarget({
        specId: options.specId,
        fileKey: options.fileKey,
        targetScope: options.targetScope,
      }),
    [options.fileKey, options.specId, options.targetScope],
  );
  const listRequestIdRef = useRef(0);
  const createRequestIdRef = useRef(0);
  const activeTargetKeyRef = useRef(createTargetKey(target));
  const [listState, setListState] = useState<ReviewRunListState>(idleListState);
  const [createState, setCreateState] =
    useState<ReviewRunCreateState>(idleCreateState);

  activeTargetKeyRef.current = createTargetKey(target);

  const reloadReviewRuns = useCallback(async (): Promise<boolean> => {
    if (options.workspacePath === null || target === null) {
      listRequestIdRef.current += 1;
      setListState(idleListState);
      return true;
    }

    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    setListState({
      status: "loading",
      target,
      active: [],
      archived: [],
      error: null,
    });

    try {
      const response = await commands.listReviewRuns({
        workspacePath: options.workspacePath,
        target,
      });

      if (listRequestIdRef.current !== requestId) {
        return false;
      }

      setListState(
        createLoadedListState(target, response.active, response.archived),
      );
      return true;
    } catch (error) {
      if (listRequestIdRef.current !== requestId) {
        return false;
      }

      setListState({
        status: "error",
        target,
        active: [],
        archived: [],
        error: normalizeCommandError(error),
      });
      return false;
    }
  }, [commands, options.workspacePath, target]);

  useEffect(() => {
    createRequestIdRef.current += 1;
    setCreateState(idleCreateState);
    void reloadReviewRuns();
  }, [reloadReviewRuns]);

  const createReviewRun = useCallback(
    async (input: CreateReviewRunInput): Promise<ReviewRun | null> => {
      if (
        options.workspacePath === null ||
        target === null ||
        input.commentIds.length === 0
      ) {
        return null;
      }

      const requestId = createRequestIdRef.current + 1;
      createRequestIdRef.current = requestId;
      const targetKey = createTargetKey(target);
      const request: CreateReviewRunRequest = {
        workspacePath: options.workspacePath,
        target,
        commentIds: input.commentIds,
        executionMode: input.executionMode,
      };

      setCreateState({
        status: "saving",
        reviewRun: null,
        error: null,
      });

      try {
        const response = await commands.createReviewRun(request);

        if (createRequestIdRef.current !== requestId) {
          return null;
        }

        setCreateState({
          status: "success",
          reviewRun: response.reviewRun,
          error: null,
        });

        if (activeTargetKeyRef.current === targetKey) {
          setListState((current) =>
            addCreatedRunToListState(current, target, response.reviewRun),
          );
        }

        return response.reviewRun;
      } catch (error) {
        if (createRequestIdRef.current !== requestId) {
          return null;
        }

        setCreateState({
          status: "error",
          reviewRun: null,
          error: normalizeCommandError(error),
        });
        return null;
      }
    },
    [commands, options.workspacePath, target],
  );

  return {
    target,
    listState,
    createState,
    activeRuns: listState.active,
    reloadReviewRuns,
    createReviewRun,
  };
}

type CreateReviewRunTargetOptions = Readonly<{
  specId: string | null;
  fileKey: SpecFileKey | null;
  targetScope: ReviewRunTargetScope;
}>;

/** @returns A review-run target for file/spec scope, or null when incomplete. */
function createReviewRunTarget(
  options: CreateReviewRunTargetOptions,
): ReviewRunTarget | null {
  if (options.specId === null) {
    return null;
  }

  if (options.targetScope === "spec") {
    return {
      scope: "spec",
      specId: options.specId,
    };
  }

  if (options.fileKey === null) {
    return null;
  }

  return {
    scope: "file",
    specId: options.specId,
    fileKey: options.fileKey,
  };
}

/** @returns Loaded list state, using empty when no active or archived runs exist. */
function createLoadedListState(
  target: ReviewRunTarget,
  active: readonly ReviewRun[],
  archived: readonly ReviewRun[],
): ReviewRunListState {
  if (active.length === 0 && archived.length === 0) {
    return {
      status: "empty",
      target,
      active: [],
      archived: [],
      error: null,
    };
  }

  return {
    status: "ready",
    target,
    active,
    archived,
    error: null,
  };
}

/** @returns The list state with the newly created active run visible first. */
function addCreatedRunToListState(
  current: ReviewRunListState,
  target: ReviewRunTarget,
  reviewRun: ReviewRun,
): ReviewRunListState {
  const active =
    current.status === "ready" || current.status === "empty"
      ? [reviewRun, ...current.active.filter((run) => run.id !== reviewRun.id)]
      : [reviewRun];
  const archived =
    current.status === "ready" || current.status === "empty"
      ? current.archived
      : [];

  return {
    status: "ready",
    target,
    active,
    archived,
    error: null,
  };
}

/** @returns A stable target key for stale async result checks. */
function createTargetKey(target: ReviewRunTarget | null): string {
  if (target === null) {
    return "none";
  }

  if (target.scope === "spec") {
    return `spec:${target.specId}`;
  }

  return `file:${target.specId}:${target.fileKey}`;
}
