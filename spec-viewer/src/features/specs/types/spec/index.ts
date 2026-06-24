import type { SpecDocumentFormat, SpecFileKey } from "@/features/specs/domain/specFile";

export type {
  ConfigSource,
  SpecDocumentFormat,
  SpecFile,
  SpecFileKey,
  SpecFileStatus,
} from "@/features/specs/domain/specFile";
export type { SpecNode } from "@/features/specs/domain/specNode";
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

export type ArchiveSpecRequest = Readonly<{
  workspacePath: string;
  specId: string;
}>;

export type ArchiveSpecResponse = Readonly<{
  archivedSpecId: string;
  archivePath: string;
}>;

export type SpecDocument = Readonly<{
  key: SpecFileKey;
  format?: SpecDocumentFormat;
  path: string;
  contents: string | null;
  missing: boolean;
  blocks: readonly MarkdownBlockMetadata[];
}>;
