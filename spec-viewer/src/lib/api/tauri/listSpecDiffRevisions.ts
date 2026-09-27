import type { RevisionOption } from "@/features/diff/domain/comparisonRevision";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { ListChangedSpecFilesCommandError } from "./listChangedSpecFiles";
import { decodeRevisionOptions } from "./specDiffCatalogDecoder";
import { InvalidSpecDiffResponseError } from "./specDiffDecoder";

export const ListSpecDiffRevisionsCommand =
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
  >(ListSpecDiffRevisionsCommand, request, (error) => ({
    ...ListChangedSpecFilesCommandError.fromUnknown(error),
    command: ListSpecDiffRevisionsCommand,
  }));
  try {
    return decodeRevisionOptions(response);
  } catch (error) {
    if (error instanceof InvalidSpecDiffResponseError) {
      throw {
        command: ListSpecDiffRevisionsCommand,
        code: "invalidResponse",
        message: error.message,
        raw: error.raw,
      };
    }
    throw error;
  }
}
