import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ReadSpecFileRequest,
  SpecDocument,
  SpecTree,
} from "@/features/specs/types/spec";

import { archiveSpec } from "./archiveSpec";
import { listSpecs } from "./listSpecs";
import { readSpecFile } from "./readSpecFile";

export type SpecCommands = Readonly<{
  listSpecs: (workspacePath: string) => Promise<SpecTree>;
  readSpecFile: (request: ReadSpecFileRequest) => Promise<SpecDocument>;
  archiveSpec: (request: ArchiveSpecRequest) => Promise<ArchiveSpecResponse>;
}>;

export const specCommands: SpecCommands = {
  listSpecs,
  readSpecFile,
  archiveSpec,
};
