import type { RepositoryFileReview } from "@/features/diff/domain/repositoryDiff";

import { InvalidDiffResponseError } from "./diffPayloadDecoder";
import { invokeTauriCommand } from "./invokeTauriCommand";
import {
  createRepositoryCommandErrorCompanion,
  type RepositoryCommandErrorCode,
  type RepositoryCommandErrorOf,
} from "./repositoryDiffCommandError";
import { decodeRepositoryFileReview } from "./repositoryDiffDecoder";

export const LOAD_REPOSITORY_FILE_COMMAND = "load_repository_file" as const;

export type LoadRepositoryFileCommandRequest = Readonly<{
  worktreeId: string;
  currentSnapshotId: string;
  path: string;
}>;
export type LoadRepositoryFileCommandResponse = RepositoryFileReview;
export type LoadRepositoryFileCommandErrorCode = RepositoryCommandErrorCode;
export type LoadRepositoryFileCommandError = RepositoryCommandErrorOf<
  typeof LOAD_REPOSITORY_FILE_COMMAND
>;
export type LoadRepositoryFileCommandContract = Readonly<{
  name: typeof LOAD_REPOSITORY_FILE_COMMAND;
  request: LoadRepositoryFileCommandRequest;
  response: LoadRepositoryFileCommandResponse;
  error: LoadRepositoryFileCommandError;
}>;

export const LoadRepositoryFileCommandError =
  createRepositoryCommandErrorCompanion(LOAD_REPOSITORY_FILE_COMMAND);

/**
 * @param request - Snapshot-scoped repository-relative path to review.
 * @returns The decoded review for one file.
 * @throws LoadRepositoryFileCommandError for command or response failures.
 */
export async function loadRepositoryFile(
  request: LoadRepositoryFileCommandRequest,
): Promise<LoadRepositoryFileCommandResponse> {
  const response = await invokeTauriCommand<
    unknown,
    LoadRepositoryFileCommandRequest,
    LoadRepositoryFileCommandError
  >(
    LOAD_REPOSITORY_FILE_COMMAND,
    request,
    LoadRepositoryFileCommandError.fromUnknown,
  );

  try {
    return decodeRepositoryFileReview(response);
  } catch (error) {
    if (error instanceof InvalidDiffResponseError) {
      throw LoadRepositoryFileCommandError.invalidResponse(error);
    }
    throw error;
  }
}
