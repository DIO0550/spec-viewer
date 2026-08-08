import {
  type LoadRepositoryDiffCommandRequest,
  type LoadRepositoryDiffCommandResponse,
  loadRepositoryDiff,
} from "./loadRepositoryDiff";
import {
  type LoadRepositoryFileCommandRequest,
  type LoadRepositoryFileCommandResponse,
  loadRepositoryFile,
} from "./loadRepositoryFile";
import {
  type TraverseRepositoryIgnoredCommandRequest,
  type TraverseRepositoryIgnoredCommandResponse,
  traverseRepositoryIgnored,
} from "./traverseRepositoryIgnored";

export type RepositoryCommands = Readonly<{
  /**
   * Loads the repository-wide diff overview for one worktree.
   *
   * @param request - Worktree and optional base branch override.
   * @returns The decoded overview.
   */
  loadOverview: (
    request: LoadRepositoryDiffCommandRequest,
  ) => Promise<LoadRepositoryDiffCommandResponse>;
  /**
   * Fetches one page of a deferred ignored directory.
   *
   * @param request - Snapshot-scoped node and optional page cursor.
   * @returns The decoded page.
   */
  traverseIgnored: (
    request: TraverseRepositoryIgnoredCommandRequest,
  ) => Promise<TraverseRepositoryIgnoredCommandResponse>;
  /**
   * Loads the review for one repository-relative file.
   *
   * @param request - Snapshot-scoped path to review.
   * @returns The decoded file review.
   */
  loadFile: (
    request: LoadRepositoryFileCommandRequest,
  ) => Promise<LoadRepositoryFileCommandResponse>;
}>;

export const repositoryCommands: RepositoryCommands = {
  loadOverview: loadRepositoryDiff,
  traverseIgnored: traverseRepositoryIgnored,
  loadFile: loadRepositoryFile,
};
