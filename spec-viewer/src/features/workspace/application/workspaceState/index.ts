import type { GenerationToken } from "@/features/workspace/application/generation";
import { selectWorkspace } from "@/features/workspace/application/workspaceSelectors";
import type { Workspace } from "@/features/workspace/domain/workspace";
import type { WorkspaceError } from "@/features/workspace/domain/workspaceError";

export type WorkspaceState =
  | Readonly<{
      status: "idle";
    }>
  | Readonly<{
      status: "opening";
      requestedPath: string;
      currentWorkspace: Workspace | null;
      error: null;
    }>
  | Readonly<{
      status: "opened";
      workspace: Workspace;
      lastOpenError: WorkspaceError | null;
    }>
  | Readonly<{
      status: "failed";
      requestedPath: string;
      error: WorkspaceError;
    }>;

export type WorkspaceStateMachine = Readonly<{
  state: WorkspaceState;
  activeRequestId: GenerationToken | null;
}>;

export type WorkspaceStateEvent =
  | Readonly<{
      type: "openRequested";
      requestId: GenerationToken;
      requestedPath: string;
      preserveCurrentWorkspace: boolean;
    }>
  | Readonly<{
      type: "openSucceeded";
      requestId: GenerationToken;
      workspace: Workspace;
    }>
  | Readonly<{
      type: "openFailed";
      requestId: GenerationToken;
      error: WorkspaceError;
    }>
  | Readonly<{ type: "reset" }>;

type OpenRequestedInput = Readonly<{
  requestId: GenerationToken;
  requestedPath: string;
  preserveCurrentWorkspace: boolean;
}>;

type OpenSucceededInput = Readonly<{
  requestId: GenerationToken;
  workspace: Workspace;
}>;

type OpenFailedInput = Readonly<{
  requestId: GenerationToken;
  error: WorkspaceError;
}>;

export const WorkspaceState = {
  /** @returns The initial workspace state machine. */
  initial(): WorkspaceStateMachine {
    return {
      state: { status: "idle" },
      activeRequestId: null,
    };
  },

  /**
   * @param current - Current workspace state machine.
   * @param event - Workspace lifecycle event to apply.
   * @returns The next state machine, or the same state for stale completions.
   */
  reduce(
    current: WorkspaceStateMachine,
    event: WorkspaceStateEvent,
  ): WorkspaceStateMachine {
    if (event.type === "reset") {
      return WorkspaceState.initial();
    }

    if (event.type === "openRequested") {
      return reduceOpenRequested(current, event);
    }

    if (!isCurrentCompletion(current, event.requestId)) {
      return current;
    }

    if (event.type === "openSucceeded") {
      return {
        state: {
          status: "opened",
          workspace: event.workspace,
          lastOpenError: null,
        },
        activeRequestId: null,
      };
    }

    return reduceOpenFailed(current, event.error);
  },

  /** @returns An event describing the start of a workspace open request. */
  openRequested(input: OpenRequestedInput): WorkspaceStateEvent {
    return { type: "openRequested", ...input };
  },

  /** @returns An event describing a successful workspace open request. */
  openSucceeded(input: OpenSucceededInput): WorkspaceStateEvent {
    return { type: "openSucceeded", ...input };
  },

  /** @returns An event describing a failed workspace open request. */
  openFailed(input: OpenFailedInput): WorkspaceStateEvent {
    return { type: "openFailed", ...input };
  },

  /** @returns An event that clears workspace state and invalidates completions. */
  reset(): WorkspaceStateEvent {
    return { type: "reset" };
  },
} as const;

/** @returns Opening state for a newly accepted request event. */
function reduceOpenRequested(
  current: WorkspaceStateMachine,
  event: Extract<WorkspaceStateEvent, { type: "openRequested" }>,
): WorkspaceStateMachine {
  const currentWorkspace = event.preserveCurrentWorkspace
    ? selectWorkspace(current.state)
    : null;

  return {
    state: {
      status: "opening",
      requestedPath: event.requestedPath,
      currentWorkspace,
      error: null,
    },
    activeRequestId: event.requestId,
  };
}

/** @returns True when a completion belongs to the active opening request. */
function isCurrentCompletion(
  current: WorkspaceStateMachine,
  requestId: GenerationToken,
): boolean {
  return (
    current.state.status === "opening" && current.activeRequestId === requestId
  );
}

/** @returns Failed or preserved-opened state for the active request. */
function reduceOpenFailed(
  current: WorkspaceStateMachine,
  error: WorkspaceError,
): WorkspaceStateMachine {
  if (current.state.status !== "opening") {
    return current;
  }

  if (current.state.currentWorkspace !== null) {
    return {
      state: {
        status: "opened",
        workspace: current.state.currentWorkspace,
        lastOpenError: error,
      },
      activeRequestId: null,
    };
  }

  return {
    state: {
      status: "failed",
      requestedPath: current.state.requestedPath,
      error,
    },
    activeRequestId: null,
  };
}
