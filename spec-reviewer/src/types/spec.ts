export type SpecFileKey =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "requirements"
  | "design";

export type SpecFileStatus = "present" | "missing";

export type SpecFile = Readonly<{
  key: SpecFileKey;
  label: string;
  fileName: string;
  status: SpecFileStatus;
}>;

export type SpecNode = Readonly<{
  id: string;
  label: string;
  files: readonly SpecFile[];
  children: readonly SpecNode[];
}>;

export type SpecTree = Readonly<{
  specs: readonly SpecNode[];
}>;

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
}>;

export type SpecDocument = Readonly<{
  key: SpecFileKey;
  path: string;
  contents: string | null;
  missing: boolean;
  blocks: readonly MarkdownBlockMetadata[];
}>;
