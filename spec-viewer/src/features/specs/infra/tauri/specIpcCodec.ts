import {
  SpecFile,
  type SpecFile as SpecFileDomain,
} from "@/features/specs/domain/specFile";
import {
  SpecNode,
  type SpecNode as SpecNodeDomain,
  type SpecNodeCapabilities,
  type SpecNodeKind,
} from "@/features/specs/domain/specNode";
import {
  SpecTree,
  type SpecTree as SpecTreeDomain,
} from "@/features/specs/domain/specTree";
import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
  ListSpecsRequest,
  ReadSpecFileRequest,
  SpecDocument,
} from "@/features/specs/types/spec";
import type {
  SpecFileWatchChangedEvent,
  SpecFileWatchErrorEvent,
  StartSpecFileWatchRequest,
  StartSpecFileWatchResponse,
  StopSpecFileWatchRequest,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import { SpecId, type SpecId as SpecIdType } from "@/shared/domain/specId";
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
const formatCodec = RuntimeCodec.literalUnion(["markdown", "html"] as const);
const blockTypeCodec = RuntimeCodec.literalUnion([
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

export type SpecFileDto = Readonly<{
  key: typeof fileKeyCodec extends RuntimeCodecType<infer Value>
    ? Value
    : never;
  label: string;
  fileName: string;
  status: "present" | "missing";
  format: "markdown" | "html";
  configSource: "default" | "workspaceConfig" | "specOverride";
}>;

export type SpecNodeDto = Readonly<{
  id: string;
  label: string;
  kind: SpecNodeKind;
  capabilities: SpecNodeCapabilities;
  files: readonly SpecFileDto[];
  children: readonly SpecNodeDto[];
}>;

export type SpecTreeDto = Readonly<{ specs: readonly SpecNodeDto[] }>;

type SpecDocumentDto = Readonly<{
  key: SpecFileDto["key"];
  format: "markdown" | "html";
  path: string;
  contents: string | null;
  missing: boolean;
  blocks: readonly Readonly<{
    blockType:
      | "paragraph"
      | "heading"
      | "list_item"
      | "code_block"
      | "block_quote"
      | "table"
      | "thematic_break"
      | "html"
      | "other";
    blockIndex: number;
    textHash: string;
    textSnippet: string;
    sourceRange: Readonly<{
      startByteOffset: number;
      endByteOffset: number;
    }> | null;
  }>[];
}>;
type ArchiveSpecResponseDto = Readonly<{
  archivedSpecId: string;
  archivePath: string;
}>;
type StartSpecFileWatchResponseDto = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileDto["key"];
  strategy: string;
  watchedPaths: readonly string[];
  skippedPaths: readonly string[];
  debounceMs: number;
}>;
type StopSpecFileWatchResponseDto = Readonly<{ stopped: boolean }>;
type SpecFileWatchChangedEventDto = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileDto["key"];
  changeKind: "markdown" | "config";
  path: string;
}>;
type SpecFileWatchErrorEventDto = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileDto["key"];
  message: string;
}>;

const specFileCodec: RuntimeCodecType<SpecFileDto> = RuntimeCodec.object({
  key: fileKeyCodec,
  label: RuntimeCodec.nonEmptyString,
  fileName: RuntimeCodec.nonEmptyString,
  status: RuntimeCodec.literalUnion(["present", "missing"] as const),
  format: formatCodec,
  configSource: RuntimeCodec.literalUnion([
    "default",
    "workspaceConfig",
    "specOverride",
  ] as const),
});

const specNodeKindCodec = RuntimeCodec.literalUnion([
  "sourceGroup",
  "spec",
] as const);
const specNodeCapabilitiesCodec = RuntimeCodec.object({
  reviewable: RuntimeCodec.boolean,
  archiveable: RuntimeCodec.boolean,
});
const specNodeCodec: RuntimeCodecType<SpecNodeDto> = {
  decode(value, path) {
    return RuntimeCodec.object({
      id: RuntimeCodec.nonEmptyString,
      label: RuntimeCodec.nonEmptyString,
      kind: specNodeKindCodec,
      capabilities: specNodeCapabilitiesCodec,
      files: RuntimeCodec.array(specFileCodec),
      children: RuntimeCodec.array(specNodeCodec),
    }).decode(value, path);
  },
};

const specTreeCodec: RuntimeCodecType<SpecTreeDto> = RuntimeCodec.object({
  specs: RuntimeCodec.array(specNodeCodec),
});

const sourceRangeCodec = RuntimeCodec.object({
  startByteOffset: RuntimeCodec.nonNegativeInteger,
  endByteOffset: RuntimeCodec.nonNegativeInteger,
});

const markdownBlockCodec = RuntimeCodec.object({
  blockType: blockTypeCodec,
  blockIndex: RuntimeCodec.nonNegativeInteger,
  textHash: RuntimeCodec.string,
  textSnippet: RuntimeCodec.string,
  sourceRange: RuntimeCodec.nullable(sourceRangeCodec),
});

const specDocumentCodec: RuntimeCodecType<SpecDocumentDto> =
  RuntimeCodec.object({
    key: fileKeyCodec,
    format: formatCodec,
    path: RuntimeCodec.nonEmptyString,
    contents: RuntimeCodec.nullable(RuntimeCodec.string),
    missing: RuntimeCodec.boolean,
    blocks: RuntimeCodec.array(markdownBlockCodec),
  });

const archiveSpecCodec: RuntimeCodecType<ArchiveSpecResponseDto> =
  RuntimeCodec.object({
    archivedSpecId: RuntimeCodec.nonEmptyString,
    archivePath: RuntimeCodec.nonEmptyString,
  });

const startWatchCodec: RuntimeCodecType<StartSpecFileWatchResponseDto> =
  RuntimeCodec.object({
    workspacePath: RuntimeCodec.nonEmptyString,
    specId: RuntimeCodec.nonEmptyString,
    fileKey: fileKeyCodec,
    strategy: RuntimeCodec.nonEmptyString,
    watchedPaths: RuntimeCodec.array(RuntimeCodec.nonEmptyString),
    skippedPaths: RuntimeCodec.array(RuntimeCodec.nonEmptyString),
    debounceMs: RuntimeCodec.nonNegativeInteger,
  });

const stopWatchCodec: RuntimeCodecType<StopSpecFileWatchResponseDto> =
  RuntimeCodec.object({ stopped: RuntimeCodec.boolean });

const watchChangedCodec: RuntimeCodecType<SpecFileWatchChangedEventDto> =
  RuntimeCodec.object({
    workspacePath: RuntimeCodec.nonEmptyString,
    specId: RuntimeCodec.nonEmptyString,
    fileKey: fileKeyCodec,
    changeKind: RuntimeCodec.literalUnion(["markdown", "config"] as const),
    path: RuntimeCodec.nonEmptyString,
  });

const watchErrorCodec: RuntimeCodecType<SpecFileWatchErrorEventDto> =
  RuntimeCodec.object({
    workspacePath: RuntimeCodec.nonEmptyString,
    specId: RuntimeCodec.nonEmptyString,
    fileKey: fileKeyCodec,
    message: RuntimeCodec.string,
  });

export const encodeListSpecsRequest = (request: ListSpecsRequest) => ({
  workspacePath: request.workspacePath,
});
export const encodeReadSpecFileRequest = (request: ReadSpecFileRequest) => ({
  workspacePath: request.workspacePath,
  specId: SpecId.toDto(request.specId),
  fileKey: request.fileKey,
  ...(request.correlationId === undefined
    ? {}
    : { correlationId: request.correlationId }),
});
export const encodeArchiveSpecRequest = (request: ArchiveSpecRequest) => ({
  workspacePath: request.workspacePath,
  specId: SpecId.toDto(request.specId),
});
export const encodeStartSpecFileWatchRequest = (
  request: StartSpecFileWatchRequest,
) => ({
  workspacePath: request.workspacePath,
  specId: SpecId.toDto(request.specId),
  fileKey: request.fileKey,
});
export const encodeStopSpecFileWatchRequest = (
  _request: StopSpecFileWatchRequest,
) => ({});

export function decodeListSpecsResponse(value: unknown): SpecTreeDomain {
  const dto = decodeRuntimeValue("list_specs", specTreeCodec, value);
  return SpecTree.create(
    dto.specs.map((node, index) =>
      mapSpecNodeDtoToDomain("list_specs", node, `$.specs[${index}]`),
    ),
  );
}

export function decodeReadSpecFileResponse(value: unknown): SpecDocument {
  return { ...decodeRuntimeValue("read_spec_file", specDocumentCodec, value) };
}

export function decodeArchiveSpecResponse(value: unknown): ArchiveSpecResponse {
  const dto = decodeRuntimeValue("archive_spec", archiveSpecCodec, value);
  return {
    archivedSpecId: decodeSpecId(
      "archive_spec",
      "$.archivedSpecId",
      dto.archivedSpecId,
    ),
    archivePath: dto.archivePath,
  };
}

export function decodeStartSpecFileWatchResponse(
  value: unknown,
): StartSpecFileWatchResponse {
  const dto = decodeRuntimeValue(
    "start_spec_file_watch",
    startWatchCodec,
    value,
  );
  return {
    ...dto,
    specId: decodeSpecId("start_spec_file_watch", "$.specId", dto.specId),
  };
}

export function decodeStopSpecFileWatchResponse(
  value: unknown,
): StopSpecFileWatchResponse {
  return {
    ...decodeRuntimeValue("stop_spec_file_watch", stopWatchCodec, value),
  };
}

export function decodeSpecFileWatchChangedEvent(
  value: unknown,
): SpecFileWatchChangedEvent {
  const command = "spec-file-watch://changed";
  const dto = decodeRuntimeValue(command, watchChangedCodec, value);
  return {
    ...dto,
    specId: decodeSpecId(command, "$.specId", dto.specId),
  };
}

export function decodeSpecFileWatchErrorEvent(
  value: unknown,
): SpecFileWatchErrorEvent {
  const command = "spec-file-watch://error";
  const dto = decodeRuntimeValue(command, watchErrorCodec, value);
  return {
    ...dto,
    specId: decodeSpecId(command, "$.specId", dto.specId),
  };
}

/**
 * @param command - Tauri command that produced the DTO.
 * @param dto - Structurally decoded spec node DTO.
 * @param path - JSON path of the spec node DTO.
 * @returns A spec node restored with validated identities.
 * @throws {IpcResponseDecodeError} When an identity is invalid.
 */
function mapSpecNodeDtoToDomain(
  command: string,
  dto: SpecNodeDto,
  path: string,
): SpecNodeDomain {
  return SpecNode.create({
    id: decodeSpecId(command, `${path}.id`, dto.id),
    label: dto.label,
    kind: dto.kind,
    capabilities: dto.capabilities,
    files: dto.files.map(mapSpecFileDtoToDomain),
    children: dto.children.map((child, index) =>
      mapSpecNodeDtoToDomain(command, child, `${path}.children[${index}]`),
    ),
  });
}

function mapSpecFileDtoToDomain(dto: SpecFileDto): SpecFileDomain {
  return SpecFile.create({ ...dto });
}

/**
 * @param command - Tauri command that produced the value.
 * @param path - JSON path of the identity.
 * @param value - Raw identity received over IPC.
 * @returns A restored SpecId.
 * @throws {IpcResponseDecodeError} When the identity is invalid.
 */
function decodeSpecId(
  command: string,
  path: string,
  value: string,
): SpecIdType {
  const result = SpecId.fromDto(value);
  if (result.ok) {
    return result.value;
  }

  throw new IpcResponseDecodeError(command, path, "valid SpecId", value);
}
