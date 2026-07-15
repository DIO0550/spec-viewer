import type {
  SpecDocumentFormat,
  SpecFileKey,
} from "@/features/specs/domain/specFile";
import type { SpecNodeCapabilities } from "@/features/specs/domain/specNode";
import type { SpecId } from "@/shared/domain/specId";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

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

type MissingSpecDocument = Readonly<{
  kind: "missing";
  key: SpecFileKey;
  format: SpecDocumentFormat;
  path: string;
}>;

type EmptySpecDocument = Readonly<{
  kind: "empty";
  key: SpecFileKey;
  format: SpecDocumentFormat;
  path: string;
}>;

type MarkdownSpecDocument = Readonly<{
  kind: "markdown";
  key: SpecFileKey;
  path: string;
  contents: string;
  blocks: readonly MarkdownBlockMetadata[];
}>;

type HtmlSpecDocument = Readonly<{
  kind: "html";
  key: SpecFileKey;
  path: string;
  contents: string;
  allowsScripts: boolean;
}>;

export type LoadedSpecDocument =
  | EmptySpecDocument
  | MarkdownSpecDocument
  | HtmlSpecDocument;
export type SpecDocument = MissingSpecDocument | LoadedSpecDocument;

type MissingSpecDocumentInput = Readonly<{
  key: SpecFileKey;
  format: SpecDocumentFormat;
  path: string;
}>;

type LoadedMarkdownSpecDocumentInput = Readonly<{
  key: SpecFileKey;
  format: "markdown";
  path: string;
  contents: string;
  blocks: readonly MarkdownBlockMetadata[];
}>;

type LoadedHtmlSpecDocumentInput = Readonly<{
  key: SpecFileKey;
  format: "html";
  path: string;
  contents: string;
  allowsScripts: boolean;
}>;

type LoadedSpecDocumentInput =
  | LoadedMarkdownSpecDocumentInput
  | LoadedHtmlSpecDocumentInput;

export type DocumentReadability = "immediate" | "afterRender";
export type DocumentPreview = "none" | "markdown" | "html";
export type SpecDocumentCapabilities = Readonly<{
  readability: DocumentReadability;
  commentable: boolean;
  preview: DocumentPreview;
  allowsScripts: boolean;
}>;

export type DocumentIdentity = Readonly<{
  workspacePath: WorkspacePath;
  specId: SpecId;
  fileKey: SpecFileKey;
  loadRevision: string;
}>;

export const SpecDocument = {
  /**
   * @param input - Validated identity and format for an absent configured file.
   * @returns Missing document variant without content-bearing fields.
   */
  missing(input: MissingSpecDocumentInput): MissingSpecDocument {
    return { kind: "missing", ...input };
  },

  /**
   * @param input - Loaded Markdown or HTML data from the infrastructure boundary.
   * @returns Empty, Markdown, or HTML document variant.
   */
  loaded(input: LoadedSpecDocumentInput): LoadedSpecDocument {
    if (input.contents.trim().length === 0) {
      return {
        kind: "empty",
        key: input.key,
        format: input.format,
        path: input.path,
      };
    }

    if (input.format === "html") {
      return {
        kind: "html",
        key: input.key,
        path: input.path,
        contents: input.contents,
        allowsScripts: input.allowsScripts,
      };
    }

    return {
      kind: "markdown",
      key: input.key,
      path: input.path,
      contents: input.contents,
      blocks: [...input.blocks],
    };
  },

  /**
   * @param document - Document variant to inspect.
   * @returns Source format represented by the variant.
   */
  format(document: SpecDocument): SpecDocumentFormat {
    if (document.kind === "markdown") {
      return "markdown";
    }
    if (document.kind === "html") {
      return "html";
    }

    return document.format;
  },
} as const;

export const SpecDocumentPolicy = {
  /**
   * @param document - Document variant to inspect.
   * @returns Readability policy for the document variant.
   */
  readability(document: SpecDocument): DocumentReadability {
    if (document.kind === "missing" || document.kind === "empty") {
      return "immediate";
    }

    return "afterRender";
  },

  /**
   * @param document - Document variant to inspect.
   * @returns Preview kind for the document variant.
   */
  preview(document: SpecDocument): DocumentPreview {
    if (document.kind === "markdown" || document.kind === "html") {
      return document.kind;
    }

    return "none";
  },

  /**
   * @param document - Document variant to inspect.
   * @returns Whether the HTML preview may execute scripts.
   */
  allowsScripts(document: SpecDocument): boolean {
    return document.kind === "html" && document.allowsScripts;
  },

  /**
   * @param document - Document variant to inspect.
   * @param nodeCapabilities - Explicit capabilities supplied by the spec tree boundary.
   * @returns Whether comments are supported for the document and spec node.
   */
  commentable(
    document: SpecDocument,
    nodeCapabilities: SpecNodeCapabilities,
  ): boolean {
    return (
      nodeCapabilities.reviewable &&
      SpecDocument.format(document) === "markdown"
    );
  },

  /**
   * @param document - Document variant to inspect.
   * @param nodeCapabilities - Explicit capabilities supplied by the spec tree boundary.
   * @returns Centralized readability, commentability, preview, and script policy.
   */
  capabilities(
    document: SpecDocument,
    nodeCapabilities: SpecNodeCapabilities,
  ): SpecDocumentCapabilities {
    return {
      readability: SpecDocumentPolicy.readability(document),
      commentable: SpecDocumentPolicy.commentable(document, nodeCapabilities),
      preview: SpecDocumentPolicy.preview(document),
      allowsScripts: SpecDocumentPolicy.allowsScripts(document),
    };
  },
} as const;

export const DocumentIdentity = {
  /**
   * @param input - Typed selection identity and one document-load revision.
   * @returns Structured identity that keeps component boundaries collision-free.
   */
  create(input: DocumentIdentity): DocumentIdentity {
    return { ...input };
  },

  /**
   * @param left - First document identity.
   * @param right - Second document identity, or null when no document is loaded.
   * @returns Whether all typed identity components match.
   */
  equals(left: DocumentIdentity, right: DocumentIdentity | null): boolean {
    if (right === null) {
      return false;
    }

    return (
      left.workspacePath === right.workspacePath &&
      left.specId === right.specId &&
      left.fileKey === right.fileKey &&
      left.loadRevision === right.loadRevision
    );
  },
} as const;
