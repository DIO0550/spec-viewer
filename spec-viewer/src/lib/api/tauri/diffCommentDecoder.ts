import type {
  DiffAnchorResolution,
  DiffCommentMutationOutcome,
  DiffLineAnchor,
  DiffReviewIdentity,
  ResolvedDiffComment,
  ResolvedDiffComments,
  ResolutionWarning,
} from "@/features/diffComments";
import { isCanonicalDiffCommentRevision } from "@/features/diffComments";

import { isRecord } from "./isRecord";

export class InvalidDiffCommentResponseError extends Error {
  readonly code: "invalidResponse" | "invalidRevision";
  readonly raw: unknown;

  /**
   * @param message - Stable validation failure message.
   * @param raw - Complete rejected IPC response.
   * @param code - Validation classification.
   */
  constructor(
    message: string,
    raw: unknown,
    code: "invalidResponse" | "invalidRevision" = "invalidResponse",
  ) {
    super(message);
    this.name = "InvalidDiffCommentResponseError";
    this.code = code;
    this.raw = raw;
  }
}

const U32_MAX = 4_294_967_295;
const REPOSITORY_ID_PATTERN = /^rr1_[0-9a-f]{64}$/;
const WORKTREE_ID_PATTERN = /^rw1_[0-9a-f]{64}$/;
const SNAPSHOT_ID_PATTERN = /^rs1_[0-9a-f]{64}$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const LINE_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RESOLUTION_WARNING_CODES = [
  "io",
  "permission",
  "budgetExceeded",
  "cancelled",
  "repositoryChanged",
  "durabilityUncertain",
] as const;
const UNAVAILABLE_REASONS = [
  "io",
  "permission",
  "budgetExceeded",
  "cancelled",
  "repositoryChanged",
] as const;
const STALE_REASONS = [
  "snapshotChanged",
  "pathMissing",
  "ambiguousRename",
  "contextNotFound",
  "ambiguousContext",
  "deleted",
  "binary",
  "unsupported",
] as const;

/** @throws InvalidDiffCommentResponseError for an invalid field. */
function fail(
  path: string,
  constraint: string,
  raw: unknown,
  code: "invalidResponse" | "invalidRevision" = "invalidResponse",
): never {
  throw new InvalidDiffCommentResponseError(
    `${path} must be ${constraint}`,
    raw,
    code,
  );
}

/** @returns The candidate as a record. */
function record(
  value: unknown,
  path: string,
  raw: unknown,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    return fail(path, "an object", raw);
  }

  return value;
}

/** @returns The candidate record after rejecting unknown or retired fields. */
function exactRecord(
  value: unknown,
  path: string,
  raw: unknown,
  allowedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  const decoded = record(value, path, raw);
  const unknownKey = Object.keys(decoded).find(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKey !== undefined) {
    return fail(`${path}.${unknownKey}`, "an allowed field", raw);
  }

  return decoded;
}

/** @returns The candidate string. */
function string(value: unknown, path: string, raw: unknown): string {
  if (typeof value !== "string") {
    return fail(path, "a string", raw);
  }

  return value;
}

/** @returns A non-empty string. */
function nonEmptyString(value: unknown, path: string, raw: unknown): string {
  const decoded = string(value, path, raw);
  if (decoded.trim().length === 0) {
    return fail(path, "a non-empty string", raw);
  }

  return decoded;
}

/** @returns A string matching a canonical wire representation. */
function canonicalString(
  value: unknown,
  path: string,
  raw: unknown,
  pattern: RegExp,
  constraint: string,
): string {
  const decoded = string(value, path, raw);
  if (!pattern.test(decoded)) {
    return fail(path, constraint, raw);
  }

  return decoded;
}

/** @returns A canonical repository-relative path. */
function repositoryPath(value: unknown, path: string, raw: unknown): string {
  const decoded = nonEmptyString(value, path, raw);
  const hasDrivePrefix = decoded.length >= 2 && decoded[1] === ":";
  const hasForbiddenCharacter = Array.from(decoded).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === "\\" || codePoint < 0x20 || codePoint === 0x7f;
  });
  const segments = decoded.split("/");
  if (
    decoded.startsWith("/") ||
    hasDrivePrefix ||
    hasForbiddenCharacter ||
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return fail(path, "a canonical repository-relative path", raw);
  }

  return decoded;
}

/** @returns A boolean. */
function boolean(value: unknown, path: string, raw: unknown): boolean {
  if (typeof value !== "boolean") {
    return fail(path, "a boolean", raw);
  }

  return value;
}

/** @returns A positive u32-compatible integer. */
function positiveLine(value: unknown, path: string, raw: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > U32_MAX
  ) {
    return fail(path, "an integer from 1 through u32::MAX", raw);
  }

  return value;
}

/** @returns A non-negative u32-compatible integer. */
function candidateCount(value: unknown, path: string, raw: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > U32_MAX
  ) {
    return fail(path, "an integer from 0 through u32::MAX", raw);
  }

  return value;
}

/** @returns A supported string literal. */
function literal<const Values extends readonly string[]>(
  value: unknown,
  path: string,
  raw: unknown,
  values: Values,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    return fail(path, `one of ${values.join("|")}`, raw);
  }

  return value as Values[number];
}

/** @returns A decoded string array. */
function stringArray(
  value: unknown,
  path: string,
  raw: unknown,
): readonly string[] {
  if (!Array.isArray(value)) {
    return fail(path, "an array", raw);
  }

  return value.map((item, index) => string(item, `${path}[${index}]`, raw));
}

/** @returns A canonical decimal revision string. */
export function decodeDiffCommentRevision(
  value: unknown,
  path: string,
  raw: unknown,
): string {
  const revision = string(value, path, raw);
  if (!isCanonicalDiffCommentRevision(revision)) {
    return fail(
      path,
      "a canonical unsigned u64 decimal",
      raw,
      "invalidRevision",
    );
  }

  return revision;
}

/** @returns A complete four-value identity. */
export function decodeDiffReviewIdentity(
  value: unknown,
  path = "identity",
  raw: unknown = value,
): DiffReviewIdentity {
  const decoded = exactRecord(value, path, raw, [
    "repositoryId",
    "worktreeId",
    "baseSha",
    "currentSnapshotId",
  ]);
  return decodeIdentityFields(decoded, path, raw);
}

/** @returns Canonical identity fields from a containing record. */
function decodeIdentityFields(
  decoded: Readonly<Record<string, unknown>>,
  path: string,
  raw: unknown,
): DiffReviewIdentity {
  return {
    repositoryId: canonicalString(
      decoded.repositoryId,
      `${path}.repositoryId`,
      raw,
      REPOSITORY_ID_PATTERN,
      "a canonical repository id",
    ),
    worktreeId: canonicalString(
      decoded.worktreeId,
      `${path}.worktreeId`,
      raw,
      WORKTREE_ID_PATTERN,
      "a canonical worktree id",
    ),
    baseSha: canonicalString(
      decoded.baseSha,
      `${path}.baseSha`,
      raw,
      COMMIT_SHA_PATTERN,
      "a canonical commit SHA",
    ),
    currentSnapshotId: canonicalString(
      decoded.currentSnapshotId,
      `${path}.currentSnapshotId`,
      raw,
      SNAPSHOT_ID_PATTERN,
      "a canonical snapshot id",
    ),
  };
}

/** @returns A strict side-discriminated stored anchor. */
function decodeAnchor(
  value: unknown,
  path: string,
  raw: unknown,
): DiffLineAnchor {
  const decoded = exactRecord(value, path, raw, [
    "repositoryId",
    "worktreeId",
    "baseSha",
    "currentSnapshotId",
    "side",
    "oldPath",
    "newPath",
    "line",
    "lineHash",
    "snippet",
    "contextBefore",
    "contextAfter",
  ]);
  const identity = decodeIdentityFields(decoded, path, raw);
  const side = literal(decoded.side, `${path}.side`, raw, [
    "base",
    "current",
  ] as const);
  const common = {
    ...identity,
    line: positiveLine(decoded.line, `${path}.line`, raw),
    lineHash: canonicalString(
      decoded.lineHash,
      `${path}.lineHash`,
      raw,
      LINE_HASH_PATTERN,
      "a canonical SHA-256 line hash",
    ),
    snippet: string(decoded.snippet, `${path}.snippet`, raw),
    contextBefore: stringArray(
      decoded.contextBefore,
      `${path}.contextBefore`,
      raw,
    ),
    contextAfter: stringArray(
      decoded.contextAfter,
      `${path}.contextAfter`,
      raw,
    ),
  };

  if (side === "base") {
    const newPath = decoded.newPath;
    return {
      ...common,
      side,
      oldPath: repositoryPath(decoded.oldPath, `${path}.oldPath`, raw),
      ...(newPath === undefined
        ? {}
        : { newPath: repositoryPath(newPath, `${path}.newPath`, raw) }),
    };
  }

  const oldPath = decoded.oldPath;
  return {
    ...common,
    side,
    newPath: repositoryPath(decoded.newPath, `${path}.newPath`, raw),
    ...(oldPath === undefined
      ? {}
      : { oldPath: repositoryPath(oldPath, `${path}.oldPath`, raw) }),
  };
}

/** @returns A four-way runtime resolution. */
function decodeResolution(
  value: unknown,
  path: string,
  raw: unknown,
): DiffAnchorResolution {
  const decoded = record(value, path, raw);
  const status = literal(decoded.status, `${path}.status`, raw, [
    "exact",
    "relocated",
    "stale",
    "unavailable",
  ] as const);

  if (status === "stale") {
    exactRecord(value, path, raw, ["status", "reason", "candidateCount"]);
    return {
      status,
      reason: literal(decoded.reason, `${path}.reason`, raw, STALE_REASONS),
      candidateCount: candidateCount(
        decoded.candidateCount,
        `${path}.candidateCount`,
        raw,
      ),
    };
  }

  if (status === "unavailable") {
    exactRecord(value, path, raw, ["status", "reason", "canJump"]);
    if (decoded.canJump !== false) {
      return fail(`${path}.canJump`, "false", raw);
    }

    return {
      status,
      reason: literal(
        decoded.reason,
        `${path}.reason`,
        raw,
        UNAVAILABLE_REASONS,
      ),
      canJump: false,
    };
  }

  exactRecord(value, path, raw, [
    "status",
    "selectionPath",
    "sidePath",
    "side",
    "line",
  ]);
  return {
    status,
    selectionPath: repositoryPath(
      decoded.selectionPath,
      `${path}.selectionPath`,
      raw,
    ),
    sidePath: repositoryPath(decoded.sidePath, `${path}.sidePath`, raw),
    side: literal(decoded.side, `${path}.side`, raw, [
      "base",
      "current",
    ] as const),
    line: positiveLine(decoded.line, `${path}.line`, raw),
  };
}

/** @returns A runtime comment preserving its stored fields. */
function decodeComment(
  value: unknown,
  path: string,
  raw: unknown,
): ResolvedDiffComment {
  const decoded = exactRecord(value, path, raw, [
    "id",
    "body",
    "resolved",
    "createdAt",
    "anchor",
    "anchorResolution",
  ]);
  const createdAt = nonEmptyString(decoded.createdAt, `${path}.createdAt`, raw);
  if (!Number.isFinite(Date.parse(createdAt))) {
    return fail(`${path}.createdAt`, "an RFC3339 timestamp", raw);
  }

  return {
    id: nonEmptyString(decoded.id, `${path}.id`, raw),
    body: nonEmptyString(decoded.body, `${path}.body`, raw),
    resolved: boolean(decoded.resolved, `${path}.resolved`, raw),
    createdAt,
    anchor: decodeAnchor(decoded.anchor, `${path}.anchor`, raw),
    anchorResolution: decodeResolution(
      decoded.anchorResolution,
      `${path}.anchorResolution`,
      raw,
    ),
  };
}

/** @returns A sanitized resolution warning. */
function decodeWarning(
  value: unknown,
  path: string,
  raw: unknown,
): ResolutionWarning {
  const decoded = exactRecord(value, path, raw, ["code", "message"]);
  return {
    code: literal(decoded.code, `${path}.code`, raw, RESOLUTION_WARNING_CODES),
    message: nonEmptyString(decoded.message, `${path}.message`, raw),
  };
}

/**
 * @param value - Unknown load_diff_comments response.
 * @returns A strict runtime document.
 * @throws InvalidDiffCommentResponseError for malformed response data.
 */
export function decodeDiffCommentDocument(
  value: unknown,
): ResolvedDiffComments {
  const decoded = exactRecord(value, "response", value, [
    "version",
    "repositoryId",
    "worktreeId",
    "revision",
    "comments",
    "resolutionWarnings",
  ]);
  if (decoded.version !== 1) {
    return fail("response.version", "1", value);
  }

  const identity = {
    repositoryId: canonicalString(
      decoded.repositoryId,
      "response.repositoryId",
      value,
      REPOSITORY_ID_PATTERN,
      "a canonical repository id",
    ),
    worktreeId: canonicalString(
      decoded.worktreeId,
      "response.worktreeId",
      value,
      WORKTREE_ID_PATTERN,
      "a canonical worktree id",
    ),
  };
  if (!Array.isArray(decoded.comments)) {
    return fail("response.comments", "an array", value);
  }
  if (!Array.isArray(decoded.resolutionWarnings)) {
    return fail("response.resolutionWarnings", "an array", value);
  }

  const comments = decoded.comments.map((item, index) =>
    decodeComment(item, `response.comments[${index}]`, value),
  );
  for (const comment of comments) {
    if (
      comment.anchor.repositoryId !== identity.repositoryId ||
      comment.anchor.worktreeId !== identity.worktreeId
    ) {
      return fail(
        "response.comments.anchor",
        "matching document identity",
        value,
      );
    }
  }

  return {
    version: 1,
    ...identity,
    revision: decodeDiffCommentRevision(
      decoded.revision,
      "response.revision",
      value,
    ),
    comments,
    resolutionWarnings: decoded.resolutionWarnings.map((item, index) =>
      decodeWarning(item, `response.resolutionWarnings[${index}]`, value),
    ),
  };
}

/** @returns Whether two warning lists contain the same ordered values. */
function warningsEqual(
  left: readonly ResolutionWarning[],
  right: readonly ResolutionWarning[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (warning, index) =>
        warning.code === right[index]?.code &&
        warning.message === right[index]?.message,
    )
  );
}

/**
 * @param value - Unknown mutation command response.
 * @returns An exhaustive strict mutation outcome.
 * @throws InvalidDiffCommentResponseError for malformed response data.
 */
export function decodeDiffCommentMutationOutcome(
  value: unknown,
): DiffCommentMutationOutcome {
  const decoded = record(value, "response", value);
  const kind = literal(decoded.kind, "response.kind", value, [
    "committed",
    "conflict",
    "preCommitFailure",
  ] as const);

  if (kind === "committed") {
    exactRecord(value, "response", value, [
      "kind",
      "document",
      "revision",
      "resolutionWarnings",
      "durability",
    ]);
    const document = decodeDiffCommentDocument(decoded.document);
    const revision = decodeDiffCommentRevision(
      decoded.revision,
      "response.revision",
      value,
    );
    const warnings = Array.isArray(decoded.resolutionWarnings)
      ? decoded.resolutionWarnings.map((item, index) =>
          decodeWarning(item, `response.resolutionWarnings[${index}]`, value),
        )
      : fail("response.resolutionWarnings", "an array", value);
    if (
      revision !== document.revision ||
      !warningsEqual(warnings, document.resolutionWarnings)
    ) {
      return fail("response", "matching document revision and warnings", value);
    }

    return {
      kind,
      document,
      revision,
      resolutionWarnings: warnings,
      durability: literal(decoded.durability, "response.durability", value, [
        "durable",
        "uncertain",
      ] as const),
    };
  }

  if (kind === "conflict") {
    exactRecord(value, "response", value, [
      "kind",
      "latestDocument",
      "latestRevision",
      "resolutionWarnings",
    ]);
    const latestDocument = decodeDiffCommentDocument(decoded.latestDocument);
    const latestRevision = decodeDiffCommentRevision(
      decoded.latestRevision,
      "response.latestRevision",
      value,
    );
    const warnings = Array.isArray(decoded.resolutionWarnings)
      ? decoded.resolutionWarnings.map((item, index) =>
          decodeWarning(item, `response.resolutionWarnings[${index}]`, value),
        )
      : fail("response.resolutionWarnings", "an array", value);
    if (
      latestRevision !== latestDocument.revision ||
      !warningsEqual(warnings, latestDocument.resolutionWarnings)
    ) {
      return fail(
        "response",
        "matching latest document revision and warnings",
        value,
      );
    }

    return {
      kind,
      latestDocument,
      latestRevision,
      resolutionWarnings: warnings,
    };
  }

  const code = literal(decoded.code, "response.code", value, [
    "revisionOverflow",
    "storeBusy",
    "io",
    "permission",
    "invalidStore",
  ] as const);
  if (code === "revisionOverflow") {
    exactRecord(value, "response", value, [
      "kind",
      "code",
      "currentDocument",
      "currentRevision",
      "retryable",
    ]);
    if (decoded.retryable !== false) {
      return fail("response.retryable", "false for revisionOverflow", value);
    }
    const currentDocument = decodeDiffCommentDocument(decoded.currentDocument);
    const currentRevision = decodeDiffCommentRevision(
      decoded.currentRevision,
      "response.currentRevision",
      value,
    );
    if (currentRevision !== currentDocument.revision) {
      return fail("response.currentRevision", "the document revision", value);
    }

    return {
      kind,
      code,
      currentDocument,
      currentRevision,
      retryable: false,
    };
  }

  if (code === "storeBusy" || code === "io") {
    exactRecord(value, "response", value, ["kind", "code", "retryable"]);
    if (decoded.retryable !== true) {
      return fail("response.retryable", `true for ${code}`, value);
    }
    return { kind, code, retryable: true };
  }

  exactRecord(value, "response", value, ["kind", "code", "retryable"]);
  if (decoded.retryable !== false) {
    return fail("response.retryable", `false for ${code}`, value);
  }
  return { kind, code, retryable: false };
}
