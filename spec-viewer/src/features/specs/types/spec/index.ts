import type {
  SpecDocumentFormat,
  SpecFileKey,
} from "@/features/specs/domain/specFile";

import type {
  SpecArtifactIdentity,
  SpecProgress,
} from "@/features/specs/domain/specArtifact";
export type SpecFileScope = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type {
  ConfigSource,
  SpecDocumentFormat,
  SpecFile,
  SpecFileKey,
  SpecFileStatus,
} from "@/features/specs/domain/specFile";
export type {
  SpecNode,
  SpecNodeIdentity,
  SpecNodeKind,
} from "@/features/specs/domain/specNode";
export type { SpecTree } from "@/features/specs/domain/specTree";

export type MarkdownBlockType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "code_block"
  | "block_quote"
  | "table"
  | "thematic_break"
  | "html"
  | "other";

export type MarkdownBlockSourceRange = Readonly<{
  startByteOffset: number;
  endByteOffset: number;
}>;

export type MarkdownBlockMetadata = Readonly<{
  blockType: MarkdownBlockType;
  blockIndex: number;
  textHash: string;
  textSnippet: string;
  sourceRange: MarkdownBlockSourceRange | null;
}>;

export type ListSpecsRequest = Readonly<{
  workspacePath: string;
}>;

export type ReadSpecFileRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  correlationId?: string;
}>;

export type LoadSpecBundleRequest = Readonly<{
  workspacePath: string;
  specId: string;
}>;

export type ArchiveSpecRequest = Readonly<{
  workspacePath: string;
  specId: string;
}>;

export type ArchiveSpecResponse = Readonly<{
  archivedSpecId: string;
  archivePath: string;
  sourceGroupId: string;
  destinationNodeId: string;
}>;

export type SpecDocument = Readonly<{
  key: SpecFileKey;
  format?: SpecDocumentFormat;
  path: string;
  contents: string | null;
  missing: boolean;
  blocks: readonly MarkdownBlockMetadata[];
}>;

export type SpecArtifactErrorCode =
  | "markdownRead"
  | "markdownParse"
  | "invalidArtifact";

export type SpecArtifactError = Readonly<{
  code: SpecArtifactErrorCode;
  message: string;
}>;

export type SpecArtifact = Readonly<{
  identity: SpecArtifactIdentity;
  fileKey: SpecFileKey | null;
  fileName: string;
  label: string;
  format: SpecDocumentFormat;
  progress: SpecProgress;
  path: string;
  contents: string | null;
  blocks: readonly MarkdownBlockMetadata[];
  error: SpecArtifactError | null;
}>;

export type SpecBundle = Readonly<{
  specId: string;
  progress: SpecProgress;
  artifacts: readonly SpecArtifact[];
}>;

export type { SpecArtifactIdentity, SpecProgress };
