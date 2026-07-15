import { SpecNode } from "@/features/specs/domain/specNode";
import {
  SpecTree,
  type SpecTree as SpecTreeType,
} from "@/features/specs/domain/specTree";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";

type PreferredSpecFileRequest = Readonly<{
  kind: "preferred";
  specId: SpecId | null;
  fileKey: SpecFileKey | null;
}>;

type SelectSpecRequest = Readonly<{
  kind: "spec";
  specId: SpecId;
}>;

type SelectFileRequest = Readonly<{
  kind: "file";
  specId: SpecId;
  fileKey: SpecFileKey;
}>;

export type SelectSpecFileRequest =
  | PreferredSpecFileRequest
  | SelectSpecRequest
  | SelectFileRequest;

export type ResolvedSpecFileSelection = ReturnType<
  typeof SpecTree.resolveSelection
>;

/**
 * @param tree - Current domain spec tree.
 * @param request - Preferred, spec, or file selection request.
 * @returns A domain-resolved spec and logical file key selection.
 */
export function selectSpecFile(
  tree: SpecTreeType,
  request: SelectSpecFileRequest,
): ResolvedSpecFileSelection {
  if (request.kind === "preferred") {
    return SpecTree.resolveSelection(tree, request);
  }

  const spec = SpecTree.find(tree, request.specId);
  if (spec === null) {
    return { spec: null, fileKey: null };
  }

  if (request.kind === "file") {
    return { spec, fileKey: request.fileKey };
  }

  return { spec, fileKey: SpecNode.firstFileKey(spec) };
}
