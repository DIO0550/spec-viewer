import {
  Workspace,
  type Workspace as WorkspaceAggregate,
} from "@/features/workspace/domain/workspace";
import type {
  LoadWorkspaceRequest,
  ValidateWorkspaceDirectoryRequest,
  ValidateWorkspaceDirectoryResponse,
} from "@/features/workspace/types/workspace";
import { RuntimeCodec, decodeRuntimeValue } from "@/shared/lib/runtimeCodec";

export type WorkspaceFileMappingDto = Readonly<{
  key: string;
  label: string;
  fileName: string;
  configSource: "default" | "workspaceConfig" | "specOverride";
}>;

export type WorkspaceDto = Readonly<{
  root: string;
  kind: "plugin-workspace" | "plugin-worktree" | "spec-skill";
  files: readonly WorkspaceFileMappingDto[];
}>;

type ValidateWorkspaceDirectoryResponseDto = Readonly<{
  isDirectory: boolean;
}>;

const configSourceCodec = RuntimeCodec.literalUnion([
  "default",
  "workspaceConfig",
  "specOverride",
] as const);

const workspaceFileMappingCodec: RuntimeCodec<WorkspaceFileMappingDto> =
  RuntimeCodec.object({
    key: RuntimeCodec.nonEmptyString,
    label: RuntimeCodec.nonEmptyString,
    fileName: RuntimeCodec.nonEmptyString,
    configSource: configSourceCodec,
  });

const workspaceCodec: RuntimeCodec<WorkspaceDto> = RuntimeCodec.object({
  root: RuntimeCodec.nonEmptyString,
  kind: RuntimeCodec.literalUnion([
    "plugin-workspace",
    "plugin-worktree",
    "spec-skill",
  ] as const),
  files: RuntimeCodec.array(workspaceFileMappingCodec),
});

const validateDirectoryCodec: RuntimeCodec<ValidateWorkspaceDirectoryResponseDto> =
  RuntimeCodec.object({ isDirectory: RuntimeCodec.boolean });

export function encodeLoadWorkspaceRequest(
  request: LoadWorkspaceRequest,
): Readonly<{ selectedDirectory: string }> {
  return { selectedDirectory: request.selectedDirectory };
}

export function encodeValidateWorkspaceDirectoryRequest(
  request: ValidateWorkspaceDirectoryRequest,
): Readonly<{ path: string }> {
  return { path: request.path };
}

export function decodeLoadWorkspaceResponse(
  value: unknown,
): WorkspaceAggregate {
  const dto = decodeRuntimeValue("load_workspace", workspaceCodec, value);
  return Workspace.create(dto);
}

export function decodeValidateWorkspaceDirectoryResponse(
  value: unknown,
): ValidateWorkspaceDirectoryResponse {
  return decodeRuntimeValue(
    "validate_workspace_directory",
    validateDirectoryCodec,
    value,
  );
}

export type WorkspaceDragDropEventDto =
  | Readonly<{ type: "enter"; paths: readonly string[] }>
  | Readonly<{ type: "over" }>
  | Readonly<{ type: "drop"; paths: readonly string[] }>
  | Readonly<{ type: "leave" }>;

const workspaceDragDropEventCodec: RuntimeCodec<WorkspaceDragDropEventDto> = {
  decode(value, path = "$") {
    const typeResult = RuntimeCodec.object({
      type: RuntimeCodec.string,
    }).decode(value, path);
    if (!typeResult.ok) {
      return typeResult;
    }
    if (typeResult.value.type === "enter" || typeResult.value.type === "drop") {
      return RuntimeCodec.object({
        type: RuntimeCodec.literalUnion([typeResult.value.type]),
        paths: RuntimeCodec.array(RuntimeCodec.nonEmptyString),
      }).decode(value, path);
    }
    return RuntimeCodec.object({
      type: RuntimeCodec.literalUnion(["over", "leave"] as const),
    }).decode(value, path);
  },
};

export function decodeWorkspaceDragDropEvent(
  value: unknown,
): WorkspaceDragDropEventDto {
  return decodeRuntimeValue(
    "workspace-drag-drop",
    workspaceDragDropEventCodec,
    value,
  );
}
