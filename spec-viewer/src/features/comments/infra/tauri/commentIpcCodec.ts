import {
  Comment,
  type Comment as CommentDomain,
} from "@/features/comments/domain/comment";
import type {
  AddCommentRequest,
  CommentAnchor,
  CommentAnchorResolution,
  CommentBlockType,
  CommentStatusRequest,
  DeleteCommentRequest,
  DeleteCommentResponse,
  ExportCommentsRequest,
  ExportCommentsResponse,
  GenerateLlmPromptRequest,
  GenerateLlmPromptResponse,
  ListCommentsRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from "@/features/comments/types/comment";
import { CommentId } from "@/shared/domain/commentId";
import {
  IpcResponseDecodeError,
  RuntimeCodec,
  decodeRuntimeValue,
  type RuntimeCodec as RuntimeCodecType,
} from "@/shared/lib/runtimeCodec";

const fileKeyCodec = RuntimeCodec.literalUnion([
  "exploration",
  "hearing",
  "impl",
  "tasks",
  "tech-reference",
  "test-cases",
  "requirements",
  "design",
] as const);
const blockTypeCodec: RuntimeCodecType<CommentBlockType> =
  RuntimeCodec.literalUnion([
    "paragraph",
    "heading",
    "list_item",
    "code_block",
    "block_quote",
    "table",
    "thematic_break",
    "html",
    "other",
  ] as const);

export type CommentAnchorResolutionDto = Readonly<{
  status: "resolved" | "moved" | "fuzzy" | "orphaned";
  reason:
    | "exact_match"
    | "moved_by_hash"
    | "stale_snippet"
    | "fuzzy_match"
    | "missing_original_block"
    | "ambiguous_fuzzy_candidates"
    | "below_threshold"
    | "deleted_text"
    | "unsupported_block_type";
  details: string | null;
  target: Readonly<{
    blockType: CommentBlockType;
    blockIndex: number;
    textHash: string;
    textSnippet: string;
    sourceRange: Readonly<{
      startByteOffset: number;
      endByteOffset: number;
    }> | null;
    score: number;
  }> | null;
}>;

export type CommentDto = Readonly<{
  id: string;
  anchor: Readonly<{
    fileKey:
      | "exploration"
      | "hearing"
      | "impl"
      | "tasks"
      | "tech-reference"
      | "test-cases"
      | "requirements"
      | "design";
    blockType: CommentBlockType;
    blockIndex: number;
    textHash: string;
    textSnippet: string;
    charRange: Readonly<{ start: number; end: number }>;
  }>;
  body: string;
  status: "open" | "resolved";
  resolved: boolean;
  anchorResolution: CommentAnchorResolutionDto | null;
  createdAt: string;
  updatedAt: string;
}>;

const sourceRangeCodec = RuntimeCodec.object({
  startByteOffset: RuntimeCodec.nonNegativeInteger,
  endByteOffset: RuntimeCodec.nonNegativeInteger,
});
const resolutionTargetCodec = RuntimeCodec.object({
  blockType: blockTypeCodec,
  blockIndex: RuntimeCodec.nonNegativeInteger,
  textHash: RuntimeCodec.string,
  textSnippet: RuntimeCodec.string,
  sourceRange: RuntimeCodec.nullable(sourceRangeCodec),
  score: RuntimeCodec.nonNegativeInteger,
});
const anchorResolutionCodec: RuntimeCodecType<CommentAnchorResolutionDto> =
  RuntimeCodec.object({
    status: RuntimeCodec.literalUnion([
      "resolved",
      "moved",
      "fuzzy",
      "orphaned",
    ] as const),
    reason: RuntimeCodec.literalUnion([
      "exact_match",
      "moved_by_hash",
      "stale_snippet",
      "fuzzy_match",
      "missing_original_block",
      "ambiguous_fuzzy_candidates",
      "below_threshold",
      "deleted_text",
      "unsupported_block_type",
    ] as const),
    details: RuntimeCodec.nullable(RuntimeCodec.string),
    target: RuntimeCodec.nullable(resolutionTargetCodec),
  });
const anchorCodec = RuntimeCodec.object({
  fileKey: fileKeyCodec,
  blockType: blockTypeCodec,
  blockIndex: RuntimeCodec.nonNegativeInteger,
  textHash: RuntimeCodec.string,
  textSnippet: RuntimeCodec.string,
  charRange: RuntimeCodec.object({
    start: RuntimeCodec.nonNegativeInteger,
    end: RuntimeCodec.nonNegativeInteger,
  }),
});
const commentCodec: RuntimeCodecType<CommentDto> = RuntimeCodec.object({
  id: RuntimeCodec.nonEmptyString,
  anchor: anchorCodec,
  body: RuntimeCodec.string,
  status: RuntimeCodec.literalUnion(["open", "resolved"] as const),
  resolved: RuntimeCodec.boolean,
  anchorResolution: RuntimeCodec.nullable(anchorResolutionCodec),
  createdAt: RuntimeCodec.isoDateTime,
  updatedAt: RuntimeCodec.isoDateTime,
});
const listCommentsCodec = RuntimeCodec.object({
  comments: RuntimeCodec.array(commentCodec),
});
const deleteCommentCodec = RuntimeCodec.object({
  deleted: RuntimeCodec.boolean,
});
const exportCommentsCodec = RuntimeCodec.object({
  destinationPath: RuntimeCodec.nonEmptyString,
  format: RuntimeCodec.literalUnion(["markdown", "json"] as const),
  commentCount: RuntimeCodec.nonNegativeInteger,
});
const generatePromptCodec = RuntimeCodec.object({
  prompt: RuntimeCodec.string,
  commentCount: RuntimeCodec.nonNegativeInteger,
  contextFileCount: RuntimeCodec.nonNegativeInteger,
});

export const encodeListCommentsRequest = (request: ListCommentsRequest) => ({
  workspacePath: request.workspacePath,
  specId: request.specId,
  fileKey: request.fileKey,
  ...(request.statusFilter === undefined
    ? {}
    : { statusFilter: request.statusFilter }),
  ...(request.correlationId === undefined
    ? {}
    : { correlationId: request.correlationId }),
});
export const encodeAddCommentRequest = (request: AddCommentRequest) => ({
  workspacePath: request.workspacePath,
  specId: request.specId,
  anchor: encodeAnchor(request.anchor),
  body: request.body,
});
export const encodeUpdateCommentRequest = (request: UpdateCommentRequest) => ({
  workspacePath: request.workspacePath,
  specId: request.specId,
  fileKey: request.fileKey,
  commentId: String(request.commentId),
  body: request.body,
});
export const encodeDeleteCommentRequest = (request: DeleteCommentRequest) => ({
  workspacePath: request.workspacePath,
  specId: request.specId,
  fileKey: request.fileKey,
  commentId: String(request.commentId),
});
export const encodeCommentStatusRequest = (request: CommentStatusRequest) => ({
  workspacePath: request.workspacePath,
  specId: request.specId,
  fileKey: request.fileKey,
  commentId: String(request.commentId),
});
export const encodeExportCommentsRequest = (
  request: ExportCommentsRequest,
) => ({
  workspacePath: request.workspacePath,
  target: { ...request.target },
  destinationPath: request.destinationPath,
});
export const encodeGenerateLlmPromptRequest = (
  request: GenerateLlmPromptRequest,
) => ({
  workspacePath: request.workspacePath,
  target: { ...request.target },
});

export function decodeListCommentsResponse(
  value: unknown,
): ListCommentsResponse {
  const dto = decodeRuntimeValue("list_comments", listCommentsCodec, value);
  return {
    comments: dto.comments.map((comment) =>
      mapComment("list_comments", comment),
    ),
  };
}

export const decodeAddCommentResponse = (value: unknown) =>
  decodeCommentResponse("add_comment", value);
export const decodeUpdateCommentResponse = (value: unknown) =>
  decodeCommentResponse("update_comment", value);
export const decodeResolveCommentResponse = (value: unknown) =>
  decodeCommentResponse("resolve_comment", value);
export const decodeReopenCommentResponse = (value: unknown) =>
  decodeCommentResponse("reopen_comment", value);
export const decodeToggleCommentResolvedResponse = (value: unknown) =>
  decodeCommentResponse("toggle_comment_resolved", value);

export function decodeDeleteCommentResponse(
  value: unknown,
): DeleteCommentResponse {
  return { ...decodeRuntimeValue("delete_comment", deleteCommentCodec, value) };
}

export function decodeExportCommentsResponse(
  value: unknown,
): ExportCommentsResponse {
  return {
    ...decodeRuntimeValue("export_comments", exportCommentsCodec, value),
  };
}

export function decodeGenerateLlmPromptResponse(
  value: unknown,
): GenerateLlmPromptResponse {
  return {
    ...decodeRuntimeValue("generate_llm_prompt", generatePromptCodec, value),
  };
}

function decodeCommentResponse(command: string, value: unknown): CommentDomain {
  return mapComment(command, decodeRuntimeValue(command, commentCodec, value));
}

function mapComment(command: string, dto: CommentDto): CommentDomain {
  if (dto.resolved !== (dto.status === "resolved")) {
    throw new IpcResponseDecodeError(
      command,
      "$.resolved",
      `boolean consistent with status ${dto.status}`,
      String(dto.resolved),
    );
  }

  return Comment.create({
    ...dto,
    id: CommentId.fromString(dto.id),
    anchor: { ...dto.anchor },
    anchorResolution: mapAnchorResolutionDtoToDomain(dto.anchorResolution),
  });
}

function encodeAnchor(anchor: CommentAnchor) {
  return {
    fileKey: anchor.fileKey,
    blockType: anchor.blockType,
    blockIndex: anchor.blockIndex,
    textHash: anchor.textHash,
    textSnippet: anchor.textSnippet,
    charRange: { ...anchor.charRange },
  };
}

function mapAnchorResolutionDtoToDomain(
  resolution: CommentAnchorResolutionDto | null,
): CommentAnchorResolution | null {
  if (resolution === null) {
    return null;
  }
  return {
    ...resolution,
    target: resolution.target === null ? null : { ...resolution.target },
  };
}
