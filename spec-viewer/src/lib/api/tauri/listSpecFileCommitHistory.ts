import type { SpecFileHistory } from "@/features/diff/domain/comparisonRevision";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { ListChangedSpecFilesCommandError } from "./listChangedSpecFiles";
import { decodeSpecFileHistory } from "./specDiffCatalogDecoder";
import { InvalidSpecDiffResponseError } from "./specDiffDecoder";

export const LIST_SPEC_FILE_COMMIT_HISTORY_COMMAND =
  "list_spec_file_commit_history" as const;

export type ListSpecFileCommitHistoryRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: string;
  path: string;
}>;

export async function listSpecFileCommitHistory(
  request: ListSpecFileCommitHistoryRequest,
): Promise<SpecFileHistory> {
  const response = await invokeTauriCommand<
    unknown,
    ListSpecFileCommitHistoryRequest,
    unknown
  >(LIST_SPEC_FILE_COMMIT_HISTORY_COMMAND, request, (error) => ({
    ...ListChangedSpecFilesCommandError.fromUnknown(error),
    command: LIST_SPEC_FILE_COMMIT_HISTORY_COMMAND,
  }));
  try {
    return decodeSpecFileHistory(response);
  } catch (error) {
    if (error instanceof InvalidSpecDiffResponseError) {
      throw {
        command: LIST_SPEC_FILE_COMMIT_HISTORY_COMMAND,
        code: "invalidResponse",
        message: error.message,
        raw: error.raw,
      };
    }
    throw error;
  }
}
