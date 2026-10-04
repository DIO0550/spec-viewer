import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  LoadSpecBundleRequest,
  ReadSpecFileRequest,
  SpecBundle,
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
   * Loads all present artifacts for one spec in one command.
   * @param request - Bundle request.
   */
  loadSpecBundle: (request: LoadSpecBundleRequest) => Promise<SpecBundle>;
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
