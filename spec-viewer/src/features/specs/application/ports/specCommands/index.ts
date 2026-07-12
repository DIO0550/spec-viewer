import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "@/features/specs/types/spec";

export type SpecCommands = Readonly<{
  /**
   * Lists the spec tree for a workspace.
   * @param workspacePath - Absolute path of the workspace to scan.
   */
  listSpecs: (workspacePath: string) => Promise<SpecTree>;
  /**
   * Reads a single spec file.
   * @param request - Read spec file request.
   */
  readSpecFile: (request: ReadSpecFileRequest) => Promise<SpecDocument>;
  /**
   * Archives a spec.
   * @param request - Archive spec request.
   */
  archiveSpec: (request: ArchiveSpecRequest) => Promise<ArchiveSpecResponse>;
}>;
