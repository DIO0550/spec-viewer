import type { SpecFileKey } from "@/features/specs/domain/specFile";
import type { SpecId } from "@/shared/domain/specId";

export type {
  ConfigSource,
  SpecDocumentFormat,
  SpecFile,
  SpecFileKey,
  SpecFileStatus,
} from "@/features/specs/domain/specFile";
export type {
  SpecNode,
  SpecNodeCapabilities,
  SpecNodeKind,
} from "@/features/specs/domain/specNode";
export type { SpecFileCollection } from "@/features/specs/domain/specFileCollection";
export type { SpecTree } from "@/features/specs/domain/specTree";
export type {
  MarkdownBlockMetadata,
  MarkdownBlockSourceRange,
  MarkdownBlockType,
  SpecDocument,
} from "@/features/specs/domain/specDocument";

export type ListSpecsRequest = Readonly<{
  workspacePath: string;
}>;

export type ReadSpecFileRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
  fileKey: SpecFileKey;
  correlationId?: string;
}>;

export type ArchiveSpecRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
}>;

export type ArchiveSpecResponse = Readonly<{
  archivedSpecId: SpecId;
  archivePath: string;
}>;
