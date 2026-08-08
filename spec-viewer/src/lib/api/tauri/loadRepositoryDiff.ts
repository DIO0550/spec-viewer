import type { RepositoryDiffOverview } from "@/features/diff/domain/repositoryDiff";

import { InvalidDiffResponseError } from "./diffPayloadDecoder";
import { invokeTauriCommand } from "./invokeTauriCommand";
import {
  createRepositoryCommandErrorCompanion,
  type RepositoryCommandErrorCode,
  type RepositoryCommandErrorOf,
} from "./repositoryDiffCommandError";
import { decodeRepositoryDiffOverview } from "./repositoryDiffDecoder";

export const LOAD_REPOSITORY_DIFF_COMMAND = "load_repository_diff" as const;

export type LoadRepositoryDiffCommandRequest = Readonly<{
  worktreeId: string;
  baseOverride?: string | null;
}>;
export type LoadRepositoryDiffCommandResponse = RepositoryDiffOverview;
export type LoadRepositoryDiffCommandErrorCode = RepositoryCommandErrorCode;
export type LoadRepositoryDiffCommandError = RepositoryCommandErrorOf<
  typeof LOAD_REPOSITORY_DIFF_COMMAND
>;
export type LoadRepositoryDiffCommandContract = Readonly<{
  name: typeof LOAD_REPOSITORY_DIFF_COMMAND;
  request: LoadRepositoryDiffCommandRequest;
  response: LoadRepositoryDiffCommandResponse;
  error: LoadRepositoryDiffCommandError;
}>;

export const LoadRepositoryDiffCommandError =
  createRepositoryCommandErrorCompanion(LOAD_REPOSITORY_DIFF_COMMAND);

/**
 * @param request - Worktree to inspect and an optional base branch override.
 * @returns A validated repository-wide diff overview.
 * @throws LoadRepositoryDiffCommandError for command or response failures.
 */
export async function loadRepositoryDiff(
  request: LoadRepositoryDiffCommandRequest,
): Promise<LoadRepositoryDiffCommandResponse> {
  const response = await invokeTauriCommand<
    unknown,
    LoadRepositoryDiffCommandRequest,
    LoadRepositoryDiffCommandError
  >(
    LOAD_REPOSITORY_DIFF_COMMAND,
    request,
    LoadRepositoryDiffCommandError.fromUnknown,
  );

  try {
    return decodeRepositoryDiffOverview(response);
  } catch (error) {
    if (error instanceof InvalidDiffResponseError) {
      throw LoadRepositoryDiffCommandError.invalidResponse(error);
    }
    throw error;
  }
}
