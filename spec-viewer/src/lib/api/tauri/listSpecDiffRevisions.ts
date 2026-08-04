import type { RevisionOption } from "@/features/diff/domain/comparisonRevision";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { ListChangedSpecFilesCommandError } from "./listChangedSpecFiles";
import { decodeRevisionOptions } from "./specDiffCatalogDecoder";
import { InvalidSpecDiffResponseError } from "./specDiffDecoder";

export const LIST_SPEC_DIFF_REVISIONS_COMMAND =
  "list_spec_diff_revisions" as const;

export type ListSpecDiffRevisionsRequest = Readonly<{ workspacePath: string }>;

export async function listSpecDiffRevisions(
  request: ListSpecDiffRevisionsRequest,
): Promise<readonly RevisionOption[]> {
  const response = await invokeTauriCommand<
    unknown,
    ListSpecDiffRevisionsRequest,
    unknown
  >(LIST_SPEC_DIFF_REVISIONS_COMMAND, request, (error) => ({
    ...ListChangedSpecFilesCommandError.fromUnknown(error),
    command: LIST_SPEC_DIFF_REVISIONS_COMMAND,
  }));
  try {
    return decodeRevisionOptions(response);
  } catch (error) {
    if (error instanceof InvalidSpecDiffResponseError) {
      throw {
        command: LIST_SPEC_DIFF_REVISIONS_COMMAND,
        code: "invalidResponse",
        message: error.message,
        raw: error.raw,
      };
    }
    throw error;
  }
}
