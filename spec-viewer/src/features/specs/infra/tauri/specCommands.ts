import type { SpecCommands } from "@/features/specs/application/specCommands";

import { archiveSpec } from "./archiveSpec";
import { listSpecs } from "./listSpecs";
import { loadSpecBundle } from "./loadSpecBundle";
import { readSpecFile } from "./readSpecFile";

export const specCommands: SpecCommands = {
  listSpecs,
  readSpecFile,
  loadSpecBundle,
  archiveSpec,
};
