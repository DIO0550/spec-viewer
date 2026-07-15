import type { SpecDocument } from "@/features/specs/domain/specDocument";
import type { SpecTree } from "@/features/specs/domain/specTree";
import type { SpecFeatureError } from "@/features/specs/application/specError";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type SpecGatewayResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; error: SpecFeatureError }>;

export type ReadSpecDocumentInput = Readonly<{
  workspacePath: WorkspacePath;
  specId: SpecId;
  fileKey: SpecFileKey;
  correlationId: string;
}>;

export type ArchiveSpecInput = Readonly<{
  workspacePath: WorkspacePath;
  specId: SpecId;
}>;

export type SpecGateway = Readonly<{
  /** Lists validated specs for a validated workspace path. */
  listSpecs: (
    workspacePath: WorkspacePath,
  ) => Promise<SpecGatewayResult<SpecTree>>;
  /** Reads one validated document selection. */
  readSpecDocument: (
    input: ReadSpecDocumentInput,
  ) => Promise<SpecGatewayResult<SpecDocument>>;
  /** Archives one validated spec selection. */
  archiveSpec: (input: ArchiveSpecInput) => Promise<SpecGatewayResult<void>>;
}>;
