import type { WorkspacePath } from "@/shared/domain/workspacePath";

declare const specOperationTokenBrand: unique symbol;

export type SpecOperationToken = Readonly<{
  sequence: number;
  workspaceRevision: number;
  workspacePath: WorkspacePath;
  readonly [specOperationTokenBrand]: true;
}>;

export type SpecOperationRegistry = Readonly<{
  /** Activates a workspace and invalidates every earlier operation. */
  activateWorkspace: (workspacePath: WorkspacePath | null) => void;
  /** Starts one operation when the workspace is active and idle. */
  tryStart: (workspacePath: WorkspacePath) => SpecOperationToken | null;
  /** Returns whether a token still owns the active operation slot. */
  isCurrent: (token: SpecOperationToken) => boolean;
  /** Releases the active operation slot when the token still owns it. */
  finish: (token: SpecOperationToken) => void;
}>;

/**
 * @returns A synchronous, monotonic operation registry for one specs feature instance.
 */
export function createSpecOperationRegistry(): SpecOperationRegistry {
  let activeWorkspacePath: WorkspacePath | null = null;
  let workspaceRevision = 0;
  let nextSequence = 0;
  let activeToken: SpecOperationToken | null = null;

  /**
   * @param workspacePath - Workspace becoming active, or null when it closes.
   */
  const activateWorkspace = (workspacePath: WorkspacePath | null): void => {
    workspaceRevision += 1;
    activeWorkspacePath = workspacePath;
    activeToken = null;
  };

  /**
   * @param workspacePath - Validated workspace that requests an operation slot.
   * @returns A new token, or null when another operation owns the slot.
   */
  const tryStart = (
    workspacePath: WorkspacePath,
  ): SpecOperationToken | null => {
    if (activeWorkspacePath !== workspacePath || activeToken !== null) {
      return null;
    }

    nextSequence += 1;
    activeToken = {
      sequence: nextSequence,
      workspaceRevision,
      workspacePath,
    } as SpecOperationToken;
    return activeToken;
  };

  /**
   * @param token - Token to compare with the current operation.
   * @returns Whether the token still owns the operation slot.
   */
  const isCurrent = (token: SpecOperationToken): boolean =>
    activeToken?.sequence === token.sequence &&
    activeToken.workspaceRevision === token.workspaceRevision;

  /**
   * @param token - Token that completed its operation.
   */
  const finish = (token: SpecOperationToken): void => {
    if (!isCurrent(token)) {
      return;
    }

    activeToken = null;
  };

  return {
    activateWorkspace,
    tryStart,
    isCurrent,
    finish,
  };
}
