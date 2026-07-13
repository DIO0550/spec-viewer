import {
  type ActiveUserReview,
  type ArchivedUserReview,
  UserReview,
  type UserReviewRestoreError,
  type UserReviewRestoreErrorReason,
  type UserReview as UserReviewType,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListOutcome } from "@/features/review-runs/domain/userReviewListOutcome";
import type {
  UserReviewRecordProblem,
  UserReviewRecordProblemKind,
} from "@/features/review-runs/domain/userReviewRecordProblem";
import type {
  UserReviewDto,
  UserReviewListProblemDto,
  UserReviewListProblemDtoKind,
} from "@/features/review-runs/types/userReviewIpc";

export class UserReviewIpcCodecError extends Error {
  readonly reason = "invalidShape" as const;
  readonly path: string;

  /**
   * @param path - Location of the invalid transport value.
   */
  constructor(path: string) {
    super(`Invalid user review IPC value at ${path}`);
    this.name = "UserReviewIpcCodecError";
    this.path = path;
  }
}

export class UserReviewDtoRestoreError extends Error {
  readonly reason: UserReviewRestoreErrorReason;
  readonly userReviewId: string;

  /**
   * @param error - Typed aggregate restore error.
   */
  constructor(error: UserReviewRestoreError) {
    super(`Invalid user review ${error.id}: ${error.reason}`);
    this.name = "UserReviewDtoRestoreError";
    this.reason = error.reason;
    this.userReviewId = error.id;
  }
}

export class UserReviewListRestoreError extends Error {
  readonly reason = "collectionStatusMismatch" as const;
  readonly collection: "active" | "archived";
  readonly userReviewId: string;

  /**
   * @param collection - Collection containing the mismatched review.
   * @param userReview - Review whose status disagrees with the collection.
   */
  constructor(collection: "active" | "archived", userReview: UserReviewType) {
    super(
      `User review ${userReview.id} has status ${userReview.status} in ${collection} collection`,
    );
    this.name = "UserReviewListRestoreError";
    this.collection = collection;
    this.userReviewId = userReview.id;
  }
}

/**
 * @param review - User review DTO returned from the command boundary.
 * @param path - Location of the DTO in its response envelope.
 * @returns Domain-validated user review.
 * @throws UserReviewIpcCodecError when the DTO shape is invalid.
 * @throws UserReviewDtoRestoreError when aggregate invariants are invalid.
 */
export function mapUserReviewDtoToUserReview(
  review: unknown,
  path = "userReview",
): UserReviewType {
  const result = UserReview.restore(decodeUserReviewDto(review, path));

  if (!result.ok) {
    throw new UserReviewDtoRestoreError(result.error);
  }

  return result.userReview;
}

/**
 * @param response - Mutation response returned from the command boundary.
 * @returns Domain-validated user review.
 * @throws UserReviewIpcCodecError when the response envelope is invalid.
 */
export function mapUserReviewResponseToUserReview(
  response: unknown,
): UserReviewType {
  const envelope = requireRecord(response, "response");

  return mapUserReviewDtoToUserReview(
    envelope.userReview,
    "response.userReview",
  );
}

/**
 * @param response - List response returned from the command boundary.
 * @returns Domain list outcome with validated aggregates and record problems.
 * @throws UserReviewIpcCodecError when the response envelope is invalid.
 * @throws UserReviewDtoRestoreError when aggregate invariants are invalid.
 * @throws UserReviewListRestoreError when status and collection disagree.
 */
export function mapListUserReviewsResponseToUserReviews(
  response: unknown,
): UserReviewListOutcome {
  const decodedResponse = decodeListResponse(response);
  const restoredActive = decodedResponse.active.map((review, index) =>
    mapUserReviewDtoToUserReview(review, `response.active[${index}]`),
  );
  const restoredArchived = decodedResponse.archived.map((review, index) =>
    mapUserReviewDtoToUserReview(review, `response.archived[${index}]`),
  );
  const active = requireActiveCollection(restoredActive);
  const archived = requireArchivedCollection(restoredArchived);

  return {
    active,
    archived,
    problems: decodedResponse.problems.map((problem, index) =>
      mapRecordProblem(
        decodeRecordProblem(problem, `response.problems[${index}]`),
      ),
    ),
  };
}

/**
 * @param reviews - Restored reviews from the active collection.
 * @returns Reviews narrowed to active aggregates.
 * @throws UserReviewListRestoreError when an archived review is present.
 */
function requireActiveCollection(
  reviews: readonly UserReviewType[],
): readonly ActiveUserReview[] {
  const mismatched = reviews.find(UserReview.isArchived);

  if (mismatched !== undefined) {
    throw new UserReviewListRestoreError("active", mismatched);
  }

  return reviews.filter(UserReview.isNonArchived);
}

/**
 * @param reviews - Restored reviews from the archived collection.
 * @returns Reviews narrowed to archived aggregates.
 * @throws UserReviewListRestoreError when an active review is present.
 */
function requireArchivedCollection(
  reviews: readonly UserReviewType[],
): readonly ArchivedUserReview[] {
  const mismatched = reviews.find(UserReview.isNonArchived);

  if (mismatched !== undefined) {
    throw new UserReviewListRestoreError("archived", mismatched);
  }

  return reviews.filter(UserReview.isArchived);
}

/**
 * @param problem - Transport record problem.
 * @returns Domain-owned record problem.
 */
function mapRecordProblem(
  problem: UserReviewListProblemDto,
): UserReviewRecordProblem {
  return {
    locator: problem.recordLocator,
    kind: mapRecordProblemKind(problem.kind),
    message: problem.message,
  };
}

/**
 * @param kind - Transport record problem token.
 * @returns Domain record problem kind.
 */
function mapRecordProblemKind(
  kind: UserReviewListProblemDtoKind,
): UserReviewRecordProblemKind {
  switch (kind) {
    case "legacyFolderBundle":
      return "legacyRecord";
    case "unsupportedSchemaVersion":
      return "unsupportedRecordVersion";
    case "malformedDocument":
      return "malformedRecord";
    case "recoverableDuplicate":
      return "recoverableDuplicate";
    case "conflictingCopies":
      return "conflictingCopies";
  }
}

type UserReviewListResponseEnvelope = Readonly<{
  active: readonly unknown[];
  archived: readonly unknown[];
  problems: readonly unknown[];
}>;

type StringFieldInput = Readonly<{
  record: Readonly<Record<string, unknown>>;
  key: string;
  parentPath: string;
}>;

const problemKinds: ReadonlySet<UserReviewListProblemDtoKind> = new Set([
  "legacyFolderBundle",
  "unsupportedSchemaVersion",
  "malformedDocument",
  "recoverableDuplicate",
  "conflictingCopies",
]);

/**
 * @param value - Runtime DTO value.
 * @param path - Location of the DTO in its response envelope.
 * @returns Structurally decoded user review DTO.
 * @throws UserReviewIpcCodecError when a required field has an invalid type.
 */
function decodeUserReviewDto(value: unknown, path: string): UserReviewDto {
  const record = requireRecord(value, path);
  const archivedAt = readNullableStringField({
    record,
    key: "archivedAt",
    parentPath: path,
  });

  return {
    schemaVersion: readStringField({
      record,
      key: "schemaVersion",
      parentPath: path,
    }),
    id: readNonEmptyStringField({ record, key: "id", parentPath: path }),
    status: readStringField({
      record,
      key: "status",
      parentPath: path,
    }) as UserReviewDto["status"],
    target: record.target as UserReviewDto["target"],
    recordLocator: readNonEmptyStringField({
      record,
      key: "recordLocator",
      parentPath: path,
    }),
    commentCount: readNumberField({
      record,
      key: "commentCount",
      parentPath: path,
    }),
    createdAt: readStringField({
      record,
      key: "createdAt",
      parentPath: path,
    }),
    updatedAt: readStringField({
      record,
      key: "updatedAt",
      parentPath: path,
    }),
    archivedAt,
  };
}

/**
 * @param response - Runtime list response.
 * @returns Structurally decoded response collections.
 * @throws UserReviewIpcCodecError when the envelope or a collection is invalid.
 */
function decodeListResponse(response: unknown): UserReviewListResponseEnvelope {
  const envelope = requireRecord(response, "response");

  return {
    active: requireArray(envelope.active, "response.active"),
    archived: requireArray(envelope.archived, "response.archived"),
    problems: requireArray(envelope.problems, "response.problems"),
  };
}

/**
 * @param value - Runtime record-problem value.
 * @param path - Location of the problem in the list response.
 * @returns Structurally decoded record problem.
 * @throws UserReviewIpcCodecError when a problem field is invalid.
 */
function decodeRecordProblem(
  value: unknown,
  path: string,
): UserReviewListProblemDto {
  const record = requireRecord(value, path);

  return {
    recordLocator: readStringField({
      record,
      key: "recordLocator",
      parentPath: path,
    }),
    kind: readProblemKind(record.kind, `${path}.kind`),
    message: readStringField({
      record,
      key: "message",
      parentPath: path,
    }),
  };
}

/**
 * @param value - Runtime value to decode.
 * @param path - Location of the value.
 * @returns Object record.
 * @throws UserReviewIpcCodecError when the value is not a non-array object.
 */
function requireRecord(
  value: unknown,
  path: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null) {
    throw new UserReviewIpcCodecError(path);
  }

  if (Array.isArray(value)) {
    throw new UserReviewIpcCodecError(path);
  }

  return value as Readonly<Record<string, unknown>>;
}

/**
 * @param value - Runtime value to decode.
 * @param path - Location of the value.
 * @returns Array value.
 * @throws UserReviewIpcCodecError when the value is not an array.
 */
function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new UserReviewIpcCodecError(path);
  }

  return value;
}

/**
 * @param input - Record, field key, and parent response path.
 * @returns String field.
 * @throws UserReviewIpcCodecError when the field is not a string.
 */
function readStringField(input: StringFieldInput): string {
  const value = input.record[input.key];

  if (typeof value !== "string") {
    throw new UserReviewIpcCodecError(`${input.parentPath}.${input.key}`);
  }

  return value;
}

/**
 * @param input - Record, field key, and parent response path.
 * @returns Non-empty string field.
 * @throws UserReviewIpcCodecError when the field is empty or not a string.
 */
function readNonEmptyStringField(input: StringFieldInput): string {
  const value = readStringField(input);

  if (value.trim().length === 0) {
    throw new UserReviewIpcCodecError(`${input.parentPath}.${input.key}`);
  }

  return value;
}

/**
 * @param input - Record, field key, and parent response path.
 * @returns Number field.
 * @throws UserReviewIpcCodecError when the field is not a number.
 */
function readNumberField(input: StringFieldInput): number {
  const value = input.record[input.key];

  if (typeof value !== "number") {
    throw new UserReviewIpcCodecError(`${input.parentPath}.${input.key}`);
  }

  return value;
}

/**
 * @param input - Record, field key, and parent response path.
 * @returns Nullable string field.
 * @throws UserReviewIpcCodecError when the field is neither string nor null.
 */
function readNullableStringField(input: StringFieldInput): string | null {
  const value = input.record[input.key];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new UserReviewIpcCodecError(`${input.parentPath}.${input.key}`);
  }

  return value;
}

/**
 * @param value - Runtime problem-kind token.
 * @param path - Location of the token.
 * @returns Valid problem-kind token.
 * @throws UserReviewIpcCodecError when the token is unsupported.
 */
function readProblemKind(
  value: unknown,
  path: string,
): UserReviewListProblemDtoKind {
  if (typeof value !== "string") {
    throw new UserReviewIpcCodecError(path);
  }

  if (!problemKinds.has(value as UserReviewListProblemDtoKind)) {
    throw new UserReviewIpcCodecError(path);
  }

  return value as UserReviewListProblemDtoKind;
}
