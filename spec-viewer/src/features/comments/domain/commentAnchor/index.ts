import type { SpecFileKey } from "@/features/specs/domain/specFile";

export type CommentBlockType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "code_block"
  | "block_quote"
  | "table"
  | "thematic_break"
  | "html"
  | "other";

export type CommentCharRange = Readonly<{
  start: number;
  end: number;
}>;

export type CommentAnchor = Readonly<{
  fileKey: SpecFileKey;
  blockType: CommentBlockType;
  blockIndex: number;
  textHash: string;
  textSnippet: string;
  charRange: CommentCharRange;
}>;

export type CommentAnchorResolutionStatus =
  | "resolved"
  | "moved"
  | "fuzzy"
  | "orphaned";

export type CommentAnchorResolutionReason =
  | "exact_match"
  | "moved_by_hash"
  | "stale_snippet"
  | "fuzzy_match"
  | "missing_original_block"
  | "ambiguous_fuzzy_candidates"
  | "below_threshold"
  | "deleted_text"
  | "unsupported_block_type";

export type CommentAnchorResolutionTarget = Readonly<{
  blockType: CommentBlockType;
  blockIndex: number;
  textHash: string;
  textSnippet: string;
  sourceRange: Readonly<{
    startByteOffset: number;
    endByteOffset: number;
  }> | null;
  score: number;
}>;

export type CommentAnchorResolution = Readonly<{
  status: CommentAnchorResolutionStatus;
  reason: CommentAnchorResolutionReason;
  details: string | null;
  target: CommentAnchorResolutionTarget | null;
}>;
