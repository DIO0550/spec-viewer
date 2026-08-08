import type { RevisionOption } from "@/features/diff/domain/comparisonRevision";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { ListChangedSpecFilesCommandError } from "./listChangedSpecFiles";
import { decodeRevisionOptions } from "./specDiffCatalogDecoder";
import { InvalidDiffResponseError } from "./diffPayloadDecoder";

export const LIST_SPEC_DIFF_REVISIONS_COMMAND =
  "list_spec_diff_revisions" as const;

export type ListSpecDiffRevisionsRequest = Readonly<{ workspacePath: string }>;

/**
 * Invokes the `list_spec_diff_revisions` Tauri command and decodes its response.
 *
 * @param request - Workspace path to list comparison revision options for.
 * @returns The validated readonly list of revision options.
 * @throws The command error (transport failure or `invalidResponse` when the payload violates the contract).
 */
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
    if (error instanceof InvalidDiffResponseError) {
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
