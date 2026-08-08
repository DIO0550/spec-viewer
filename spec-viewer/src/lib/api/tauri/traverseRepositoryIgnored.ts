import type { RepositoryIgnoredPage } from "@/features/diff/domain/repositoryDiff";

import { InvalidDiffResponseError } from "./diffPayloadDecoder";
import { invokeTauriCommand } from "./invokeTauriCommand";
import {
  createRepositoryCommandErrorCompanion,
  type RepositoryCommandErrorCode,
  type RepositoryCommandErrorOf,
} from "./repositoryDiffCommandError";
import { decodeRepositoryIgnoredPage } from "./repositoryDiffDecoder";

export const TRAVERSE_REPOSITORY_IGNORED_COMMAND =
  "traverse_repository_ignored" as const;

export type TraverseRepositoryIgnoredCommandRequest = Readonly<{
  worktreeId: string;
  currentSnapshotId: string;
  nodeId: string;
  cursor?: string | null;
}>;
export type TraverseRepositoryIgnoredCommandResponse = RepositoryIgnoredPage;
export type TraverseRepositoryIgnoredCommandErrorCode =
  RepositoryCommandErrorCode;
export type TraverseRepositoryIgnoredCommandError = RepositoryCommandErrorOf<
  typeof TRAVERSE_REPOSITORY_IGNORED_COMMAND
>;
export type TraverseRepositoryIgnoredCommandContract = Readonly<{
  name: typeof TRAVERSE_REPOSITORY_IGNORED_COMMAND;
  request: TraverseRepositoryIgnoredCommandRequest;
  response: TraverseRepositoryIgnoredCommandResponse;
  error: TraverseRepositoryIgnoredCommandError;
}>;

export const TraverseRepositoryIgnoredCommandError =
  createRepositoryCommandErrorCompanion(TRAVERSE_REPOSITORY_IGNORED_COMMAND);

/**
 * @param request - Snapshot-scoped node to expand and an optional page cursor.
 * @returns One page of ignored-directory entries.
 * @throws TraverseRepositoryIgnoredCommandError for command or response failures.
 */
export async function traverseRepositoryIgnored(
  request: TraverseRepositoryIgnoredCommandRequest,
): Promise<TraverseRepositoryIgnoredCommandResponse> {
  const response = await invokeTauriCommand<
    unknown,
    TraverseRepositoryIgnoredCommandRequest,
    TraverseRepositoryIgnoredCommandError
  >(
    TRAVERSE_REPOSITORY_IGNORED_COMMAND,
    request,
    TraverseRepositoryIgnoredCommandError.fromUnknown,
  );

  try {
    return decodeRepositoryIgnoredPage(response);
  } catch (error) {
    if (error instanceof InvalidDiffResponseError) {
      throw TraverseRepositoryIgnoredCommandError.invalidResponse(error);
    }
    throw error;
  }
}
