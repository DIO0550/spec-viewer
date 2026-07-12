import type { SpecFileKey } from "@/features/specs/domain/specFile";
import type { SpecTree } from "@/features/specs/domain/specTree";
import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ReadSpecFileRequest,
  SpecDocument,
} from "@/features/specs/types/spec";
import type { SpecCommands } from "@/features/specs/application/ports/specCommands";

/**
 * @param commands - Spec command boundary
 * @param workspacePath - Active workspace path
 * @returns Spec tree from the command boundary.
 */
export async function listSpecs(
  commands: SpecCommands,
  workspacePath: string,
): Promise<SpecTree> {
  return commands.listSpecs(workspacePath);
}

/**
 * @param commands - Spec command boundary
 * @param request - Read request DTO
 * @returns Spec document from the command boundary.
 */
export async function readSpecFile(
  commands: SpecCommands,
  request: ReadSpecFileRequest,
): Promise<SpecDocument> {
  return commands.readSpecFile(request);
}

/**
 * @param commands - Spec command boundary
 * @param request - Archive request DTO
 * @returns Archive response from the command boundary.
 */
export async function archiveSpec(
  commands: SpecCommands,
  request: ArchiveSpecRequest,
): Promise<ArchiveSpecResponse> {
  return commands.archiveSpec(request);
}

/**
 * @param request - Document read input
 * @returns IPC read request for the selected spec file.
 */
export function createReadSpecFileRequest(
  request: Readonly<{
    workspacePath: string;
    specId: string;
    fileKey: SpecFileKey;
    correlationId?: string;
  }>,
): ReadSpecFileRequest {
  if (request.correlationId === undefined) {
    return {
      workspacePath: request.workspacePath,
      specId: request.specId,
      fileKey: request.fileKey,
    };
  }

  return {
    workspacePath: request.workspacePath,
    specId: request.specId,
    fileKey: request.fileKey,
    correlationId: request.correlationId,
  };
}
