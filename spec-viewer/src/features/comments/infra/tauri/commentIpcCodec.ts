import {
  Comment,
  type Comment as CommentDomain,
} from "@/features/comments/domain/comment";
import {
  CommentAnchor,
  type CommentAnchor as CommentAnchorDomain,
  type CommentAnchorDomainError,
} from "@/features/comments/domain/commentAnchor";
import { CommentBody } from "@/features/comments/domain/commentBody";
import type {
  AddCommentRequest,
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
import {
  CommentId,
  type CommentId as CommentIdType,
} from "@/shared/domain/commentId";
import {
  IsoDateTime,
  type IsoDateTime as IsoDateTimeType,
} from "@/shared/domain/isoDateTime";
import { SpecId } from "@/shared/domain/specId";
import {
  decodeRuntimeValue,
  IpcResponseDecodeError,
  RuntimeCodec,
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
  specId: SpecId.toDto(request.specId),
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
  specId: SpecId.toDto(request.specId),
  anchor: encodeAnchor(request.anchor),
  body: CommentBody.toString(request.body),
});
export const encodeUpdateCommentRequest = (request: UpdateCommentRequest) => ({
  workspacePath: request.workspacePath,
  specId: SpecId.toDto(request.specId),
  fileKey: request.fileKey,
  commentId: CommentId.toDto(request.commentId),
  body: CommentBody.toString(request.body),
});
export const encodeDeleteCommentRequest = (request: DeleteCommentRequest) => ({
  workspacePath: request.workspacePath,
  specId: SpecId.toDto(request.specId),
  fileKey: request.fileKey,
  commentId: CommentId.toDto(request.commentId),
});
export const encodeCommentStatusRequest = (request: CommentStatusRequest) => ({
  workspacePath: request.workspacePath,
  specId: SpecId.toDto(request.specId),
  fileKey: request.fileKey,
  commentId: CommentId.toDto(request.commentId),
});
export const encodeExportCommentsRequest = (
  request: ExportCommentsRequest,
) => ({
  workspacePath: request.workspacePath,
  target: encodeTarget(request.target),
  destinationPath: request.destinationPath,
});
export const encodeGenerateLlmPromptRequest = (
  request: GenerateLlmPromptRequest,
) => ({
  workspacePath: request.workspacePath,
  target: encodeTarget(request.target),
});

export function decodeListCommentsResponse(
  value: unknown,
): ListCommentsResponse {
  const dto = decodeRuntimeValue("list_comments", listCommentsCodec, value);
  return {
    comments: dto.comments.map((comment, index) =>
      mapComment("list_comments", comment, `$.comments[${index}]`),
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
  return mapComment(
    command,
    decodeRuntimeValue(command, commentCodec, value),
    "$",
  );
}

/**
 * @param command - Tauri command that produced the DTO.
 * @param dto - Structurally decoded comment DTO.
 * @param path - JSON path of the comment DTO.
 * @returns A comment restored with validated identities and timestamps.
 * @throws {IpcResponseDecodeError} When a domain invariant is invalid.
 */
function mapComment(
  command: string,
  dto: CommentDto,
  path: string,
): CommentDomain {
  if (dto.resolved !== (dto.status === "resolved")) {
    throw new IpcResponseDecodeError(
      command,
      `${path}.resolved`,
      `boolean consistent with status ${dto.status}`,
      String(dto.resolved),
    );
  }

  const anchor = CommentAnchor.parse(dto.anchor);

  if (!anchor.ok) {
    const description = describeAnchorError(path, anchor.error);
    throw new IpcResponseDecodeError(
      command,
      description.path,
      description.expected,
      description.actual,
    );
  }

  return Comment.create({
    id: decodeCommentId(command, `${path}.id`, dto.id),
    anchor: anchor.value,
    body: dto.body,
    status: dto.status,
    resolved: dto.resolved,
    anchorResolution: mapAnchorResolutionDtoToDomain(dto.anchorResolution),
    createdAt: decodeIsoDateTime(command, `${path}.createdAt`, dto.createdAt),
    updatedAt: decodeIsoDateTime(command, `${path}.updatedAt`, dto.updatedAt),
  });
}

/**
 * @param target - Domain-facing export target.
 * @returns A wire target with raw identities.
 */
function encodeTarget(target: ExportCommentsRequest["target"]) {
  if (target.scope === "workspace") {
    return { scope: "workspace" as const };
  }
  if (target.scope === "spec") {
    return {
      scope: "spec" as const,
      specId: SpecId.toDto(target.specId),
    };
  }
  return {
    scope: "file" as const,
    specId: SpecId.toDto(target.specId),
    fileKey: target.fileKey,
  };
}

/**
 * @param command - Tauri command that produced the value.
 * @param path - JSON path of the identity.
 * @param value - Raw identity received over IPC.
 * @returns A restored CommentId.
 * @throws {IpcResponseDecodeError} When the identity is invalid.
 */
function decodeCommentId(
  command: string,
  path: string,
  value: string,
): CommentIdType {
  const result = CommentId.fromDto(value);
  if (result.ok) {
    return result.value;
  }

  throw new IpcResponseDecodeError(command, path, "valid CommentId", value);
}

/**
 * @param command - Tauri command that produced the value.
 * @param path - JSON path of the date-time.
 * @param value - Raw date-time received over IPC.
 * @returns A restored IsoDateTime.
 * @throws {IpcResponseDecodeError} When the date-time is invalid.
 */
function decodeIsoDateTime(
  command: string,
  path: string,
  value: string,
): IsoDateTimeType {
  const result = IsoDateTime.fromDto(value);
  if (result.ok) {
    return result.value;
  }

  throw new IpcResponseDecodeError(
    command,
    path,
    "valid RFC3339 date-time",
    value,
  );
}

/**
 * @param basePath - Comment response path.
 * @param error - Typed anchor validation error.
 * @returns Exact response field, expected invariant, and received value.
 */
function describeAnchorError(
  basePath: string,
  error: CommentAnchorDomainError,
): Readonly<{ path: string; expected: string; actual: string }> {
  switch (error.reason) {
    case "unsupported_block_type":
      return {
        path: `${basePath}.anchor.blockType`,
        expected: "supported comment block type",
        actual: String(error.value),
      };
    case "invalid_block_index":
      return {
        path: `${basePath}.anchor.blockIndex`,
        expected: "non-negative safe integer",
        actual: String(error.value),
      };
    case "invalid_char_range":
      return {
        path: `${basePath}.anchor.charRange`,
        expected: "non-empty ordered character range",
        actual: JSON.stringify({ start: error.start, end: error.end }),
      };
    case "invalid_text_hash":
      return {
        path: `${basePath}.anchor.textHash`,
        expected: "non-blank text hash",
        actual: String(error.value),
      };
    case "invalid_text_snippet":
      return {
        path: `${basePath}.anchor.textSnippet`,
        expected: "non-blank text snippet",
        actual: String(error.value),
      };
  }
}

function encodeAnchor(anchor: CommentAnchorDomain) {
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
