import type { FileChange } from "@/features/diff/domain/fileDiff";
import type {
  BaseResolution,
  RepositoryDiffOverview,
  RepositoryFileReview,
  RepositoryIgnoredPage,
  RepositoryTreeChildren,
  RepositoryTreeNode,
} from "@/features/diff/domain/repositoryDiff";
import {
  BASE_OVERRIDE_REJECTIONS,
  BASE_RESOLUTION_FAILURES,
  BASE_RESOLUTION_SOURCES,
  REPOSITORY_TREE_NODE_KINDS,
  RepositoryCurrentSnapshotId,
  RepositoryId,
  RepositoryIgnoredCursor,
  RepositoryNodeId,
} from "@/features/diff/domain/repositoryDiff";

import {
  decodeBoolean,
  decodeFileChange,
  decodeFileReview,
  decodeLiteral,
  decodeNullableString,
  decodeRecord,
  decodeString,
  decodeStringArrayInPlace,
  ENTRY_KINDS,
  FILE_CHANGE_STATUSES,
  invalid,
} from "./diffPayloadDecoder";

/**
 * Rejects a payload whose fields must be null for the decoded variant.
 *
 * @param record - The record being decoded.
 * @param fields - Field names required to be null.
 * @param path - Validation path of the record.
 * @param raw - Complete raw response.
 * @throws InvalidDiffResponseError when any listed field is not null.
 */
const assertNullFields = (
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[],
  path: string,
  raw: unknown,
): void => {
  for (const field of fields) {
    if (record[field] !== null) {
      throw invalid(
        `${path}.${field}`,
        "null",
        `received ${JSON.stringify(record[field])}`,
        raw,
      );
    }
  }
};

/**
 * Promotes the backend's flat base struct into a discriminated union.
 *
 * @param value - Candidate base payload.
 * @param path - Validation path used in error messages.
 * @param raw - Complete raw response.
 * @returns The decoded base resolution variant.
 * @throws InvalidDiffResponseError when the state is unknown or a variant's null contract is violated.
 */
const decodeBaseResolution = (
  value: unknown,
  path: string,
  raw: unknown,
): BaseResolution => {
  const record = decodeRecord(value, path, raw);

  if (record.state === "resolved") {
    assertNullFields(record, ["reason", "overrideRef"], path, raw);

    return {
      state: "resolved",
      source:
        record.source === null
          ? null
          : decodeLiteral(
              record.source,
              `${path}.source`,
              raw,
              BASE_RESOLUTION_SOURCES,
            ),
      branchRef: decodeString(record.branchRef, `${path}.branchRef`, raw),
      mergeBaseSha: decodeString(
        record.mergeBaseSha,
        `${path}.mergeBaseSha`,
        raw,
      ),
      headSha: decodeString(record.headSha, `${path}.headSha`, raw),
    };
  }

  if (record.state === "needsSelection") {
    assertNullFields(
      record,
      ["source", "branchRef", "mergeBaseSha", "headSha", "overrideRef"],
      path,
      raw,
    );

    return {
      state: "needsSelection",
      reason: decodeLiteral(
        record.reason,
        `${path}.reason`,
        raw,
        BASE_RESOLUTION_FAILURES,
      ),
      candidates: decodeStringArrayInPlace(
        record.candidates,
        `${path}.candidates`,
        raw,
      ),
    };
  }

  if (record.state === "invalidOverride") {
    assertNullFields(
      record,
      ["source", "branchRef", "mergeBaseSha", "headSha"],
      path,
      raw,
    );

    return {
      state: "invalidOverride",
      reason: decodeLiteral(
        record.reason,
        `${path}.reason`,
        raw,
        BASE_OVERRIDE_REJECTIONS,
      ),
      overrideRef: decodeString(record.overrideRef, `${path}.overrideRef`, raw),
    };
  }

  throw invalid(
    `${path}.state`,
    "one of resolved|needsSelection|invalidOverride",
    `received ${JSON.stringify(record.state)}`,
    raw,
  );
};

/**
 * Decodes the only serde-tagged enum in the backend contract (`tag = "state"`).
 *
 * @param value - Candidate children payload.
 * @param path - Validation path used in error messages.
 * @param raw - Complete raw response.
 * @returns Loaded child nodes, or the node ID needed to fetch them lazily.
 * @throws InvalidDiffResponseError when the state is unknown or a field is missing.
 */
const decodeTreeChildren = (
  value: unknown,
  path: string,
  raw: unknown,
): RepositoryTreeChildren => {
  const record = decodeRecord(value, path, raw);

  if (record.state === "loaded") {
    if (!Array.isArray(record.items)) {
      throw invalid(
        `${path}.items`,
        "an array",
        "received a non-array value",
        raw,
      );
    }

    return {
      state: "loaded",
      items: record.items.map((candidate, index) =>
        decodeTreeNode(candidate, `${path}.items[${index}]`, raw),
      ),
    };
  }

  if (record.state === "deferred") {
    return {
      state: "deferred",
      nodeId: RepositoryNodeId.fromString(
        decodeString(record.nodeId, `${path}.nodeId`, raw),
      ),
    };
  }

  throw invalid(
    `${path}.state`,
    "one of loaded|deferred",
    `received ${JSON.stringify(record.state)}`,
    raw,
  );
};

/**
 * Decodes one tree node and, recursively, its loaded children.
 *
 * `ignored` stays an independent flag: it never collapses into `change`.
 *
 * @param value - Candidate node payload.
 * @param path - Validation path used in error messages.
 * @param raw - Complete raw response.
 * @returns The decoded tree node.
 * @throws InvalidDiffResponseError when any field violates the contract.
 */
const decodeTreeNode = (
  value: unknown,
  path: string,
  raw: unknown,
): RepositoryTreeNode => {
  const record = decodeRecord(value, path, raw);

  return {
    path: decodeString(record.path, `${path}.path`, raw),
    name: decodeString(record.name, `${path}.name`, raw),
    kind: decodeLiteral(
      record.kind,
      `${path}.kind`,
      raw,
      REPOSITORY_TREE_NODE_KINDS,
    ),
    entryKind:
      record.entryKind === null
        ? null
        : decodeLiteral(
            record.entryKind,
            `${path}.entryKind`,
            raw,
            ENTRY_KINDS,
          ),
    change:
      record.change === null
        ? null
        : decodeLiteral(
            record.change,
            `${path}.change`,
            raw,
            FILE_CHANGE_STATUSES,
          ),
    ignored: decodeBoolean(record.ignored, `${path}.ignored`, raw),
    children: decodeTreeChildren(record.children, `${path}.children`, raw),
  };
};

/**
 * Enforces the old/new path invariants the backend guarantees per change kind.
 *
 * @param file - Decoded file change metadata.
 * @param path - Validation path of the change entry.
 * @param raw - Complete raw response.
 * @throws InvalidDiffResponseError when a path is absent or duplicated for the change kind.
 */
const assertPathInvariant = (
  file: FileChange,
  path: string,
  raw: unknown,
): void => {
  if (
    (file.change === "added" || file.change === "untracked") &&
    file.newPath === null
  ) {
    throw invalid(
      `${path}.newPath`,
      "a string",
      `${file.change} change has no new path`,
      raw,
    );
  }

  if (file.change === "deleted" && file.oldPath === null) {
    throw invalid(
      `${path}.oldPath`,
      "a string",
      "deleted change has no old path",
      raw,
    );
  }

  if (
    (file.change === "renamed" || file.change === "copied") &&
    (file.oldPath === null ||
      file.newPath === null ||
      file.oldPath === file.newPath)
  ) {
    throw invalid(
      path,
      "distinct non-null old and new paths",
      `${file.change} change has ambiguous paths`,
      raw,
    );
  }
};

/**
 * Decodes one changed-file entry and validates its path invariants.
 *
 * @param value - Candidate change payload.
 * @param path - Validation path used in error messages.
 * @param raw - Complete raw response.
 * @returns The decoded file change metadata.
 * @throws InvalidDiffResponseError when a field or a path invariant is violated.
 */
const decodeChangedFile = (
  value: unknown,
  path: string,
  raw: unknown,
): FileChange => {
  const file = decodeFileChange(value, path, raw);
  assertPathInvariant(file, path, raw);

  return file;
};

/**
 * Decodes an array of tree nodes at the given validation path.
 *
 * @param value - Candidate array payload.
 * @param path - Validation path used in error messages.
 * @param raw - Complete raw response.
 * @returns The decoded tree nodes in backend order.
 * @throws InvalidDiffResponseError when the value is not an array of nodes.
 */
const decodeTreeNodeArray = (
  value: unknown,
  path: string,
  raw: unknown,
): readonly RepositoryTreeNode[] => {
  if (!Array.isArray(value)) {
    throw invalid(path, "an array", "received a non-array value", raw);
  }

  return value.map((candidate, index) =>
    decodeTreeNode(candidate, `${path}[${index}]`, raw),
  );
};

/**
 * @param value - Unknown load_repository_diff response.
 * @returns A validated repository-wide diff overview.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
export function decodeRepositoryDiffOverview(
  value: unknown,
): RepositoryDiffOverview {
  const record = decodeRecord(value, "response", value);

  if (!Array.isArray(record.changed)) {
    throw invalid("changed", "an array", "received a non-array value", value);
  }

  const repositoryId = decodeNullableString(
    record.repositoryId,
    "repositoryId",
    value,
  );
  const currentSnapshotId = decodeNullableString(
    record.currentSnapshotId,
    "currentSnapshotId",
    value,
  );

  return {
    repositoryId:
      repositoryId === null ? null : RepositoryId.fromString(repositoryId),
    base: decodeBaseResolution(record.base, "base", value),
    currentSnapshotId:
      currentSnapshotId === null
        ? null
        : RepositoryCurrentSnapshotId.fromString(currentSnapshotId),
    changed: record.changed.map((candidate, index) =>
      decodeChangedFile(candidate, `changed[${index}]`, value),
    ),
    changedTree: decodeTreeNodeArray(record.changedTree, "changedTree", value),
    allRoot: decodeTreeNodeArray(record.allRoot, "allRoot", value),
    all: decodeStringArrayInPlace(record.all, "all", value),
    ignoredDirectories: decodeStringArrayInPlace(
      record.ignoredDirectories,
      "ignoredDirectories",
      value,
    ),
    warnings: decodeStringArrayInPlace(record.warnings, "warnings", value),
  };
}

/**
 * @param value - Unknown traverse_repository_ignored response.
 * @returns A validated lazy ignored-directory page.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
export function decodeRepositoryIgnoredPage(
  value: unknown,
): RepositoryIgnoredPage {
  const record = decodeRecord(value, "response", value);
  const nextCursor = decodeNullableString(
    record.nextCursor,
    "nextCursor",
    value,
  );

  return {
    nodeId: RepositoryNodeId.fromString(
      decodeString(record.nodeId, "nodeId", value),
    ),
    entries: decodeTreeNodeArray(record.entries, "entries", value),
    nextCursor:
      nextCursor === null
        ? null
        : RepositoryIgnoredCursor.fromString(nextCursor),
  };
}

/**
 * @param value - Unknown load_repository_file response.
 * @returns A validated file review for one repository-relative path.
 * @throws InvalidDiffResponseError when the response violates the contract.
 */
export function decodeRepositoryFileReview(
  value: unknown,
): RepositoryFileReview {
  return decodeFileReview(value, "response", value);
}
