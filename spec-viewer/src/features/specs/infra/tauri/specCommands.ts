import type { SpecCommands } from "@/features/specs/application/ports/specCommands";

import { archiveSpec } from "./archiveSpec";
import { listSpecs } from "./listSpecs";
import { readSpecFile } from "./readSpecFile";

export const specCommands: SpecCommands = {
  listSpecs,
  readSpecFile,
  archiveSpec,
};
