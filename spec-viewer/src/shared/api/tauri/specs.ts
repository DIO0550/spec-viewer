import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "@/features/specs/types/spec";

import { invokeCommand } from "./invokeCommand";

/**
 * @param workspacePath - Absolute workspace path.
 * @returns Spec tree for the workspace path.
 */
export async function listSpecs(workspacePath: string): Promise<SpecTree> {
  return invokeCommand("list_specs", { workspacePath });
}

/**
 * @param request - Workspace, spec, and file key to read.
 * @returns Markdown contents or missing-file metadata for a spec file.
 */
export async function readSpecFile(
  request: ReadSpecFileRequest,
): Promise<SpecDocument> {
  return invokeCommand("read_spec_file", request);
}

/**
 * @param request - Workspace and spec id to archive.
 * @returns Metadata for the spec directory moved into the workspace archive.
 */
export async function archiveSpec(
  request: ArchiveSpecRequest,
): Promise<ArchiveSpecResponse> {
  return invokeCommand("archive_spec", request);
}
