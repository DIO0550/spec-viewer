import type { IsoDateTimeString } from "@/features/comments/types/comment";
import {
  UserReviewTarget,
  type UserReviewTarget as UserReviewTargetType,
} from "@/features/review-runs/domain/userReviewTarget";

export const USER_REVIEW_SCHEMA_VERSION =
  "spec-reviewer.user-review.v1" as const;

export type UserReviewStatus = "active" | "archived";

export type UserReviewBase = Readonly<{
  schemaVersion: typeof USER_REVIEW_SCHEMA_VERSION;
  id: string;
  target: UserReviewTargetType;
  recordLocator: string;
  commentCount: number;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}>;

export type ActiveUserReview = UserReviewBase &
  Readonly<{
    status: "active";
    archivedAt: null;
  }>;

export type ArchivedUserReview = UserReviewBase &
  Readonly<{
    status: "archived";
    archivedAt: IsoDateTimeString;
  }>;

export type NonArchivedUserReview = ActiveUserReview;
export type UserReview = ActiveUserReview | ArchivedUserReview;

export type StoredUserReview = Readonly<{
  schemaVersion: string;
  id: string;
  status: UserReviewStatus;
  target: UserReviewTargetType;
  recordLocator: string;
  commentCount: number;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  archivedAt: IsoDateTimeString | null;
}>;

export type UserReviewRestoreErrorReason =
  | "unsupportedSchemaVersion"
  | "invalidStatus"
  | "invalidTarget"
  | "invalidCommentCount"
  | "invalidTimestamp"
  | "updatedBeforeCreated"
  | "activeHasArchivedAt"
  | "activeTimestampsDiffer"
  | "archivedMissingArchivedAt"
  | "archivedTimestampsDiffer";

export type UserReviewRestoreError = Readonly<{
  reason: UserReviewRestoreErrorReason;
  id: string;
}>;

export type UserReviewRestoreResult =
  | Readonly<{ ok: true; userReview: UserReview }>
  | Readonly<{ ok: false; error: UserReviewRestoreError }>;

export type UserReviewArchiveError = Readonly<{
  reason: "alreadyArchived" | "invalidTimestamp" | "archiveTimestampRollback";
  id: string;
}>;

export type UserReviewArchiveResult =
  | Readonly<{ ok: true; userReview: ArchivedUserReview }>
  | Readonly<{ ok: false; error: UserReviewArchiveError }>;

export const UserReviewStatus = {
  /**
   * @param status - Runtime status value.
   * @returns True when status belongs to the single-JSON lifecycle.
   */
  isValid(status: unknown): status is UserReviewStatus {
    return status === "active" || status === "archived";
  },

  /**
   * @param status - User review status.
   * @returns True when status belongs to the archived collection.
   */
  isArchived(status: UserReviewStatus): status is "archived" {
    return status === "archived";
  },

  /**
   * @param status - User review status.
   * @returns True when status belongs to the active collection.
   */
  isNonArchived(status: UserReviewStatus): status is "active" {
    return status === "active";
  },
} as const;

export const UserReview = {
  /**
   * @param storedUserReview - User review restored from an IPC or persistence boundary.
   * @returns Validated aggregate or a typed invariant error.
   */
  restore(storedUserReview: StoredUserReview): UserReviewRestoreResult {
    const error = validateStoredUserReview(storedUserReview);

    if (error !== null) {
      return { ok: false, error };
    }

    return {
      ok: true,
      userReview: storedUserReview as UserReview,
    };
  },

  /**
   * @param userReview - User review to inspect.
   * @returns True when the review can transition to archived.
   */
  canArchive(userReview: UserReview): userReview is ActiveUserReview {
    return userReview.status === "active";
  },

  /**
   * @param userReview - Active user review to archive.
   * @param archivedAt - Timestamp for the archive transition.
   * @returns Archived aggregate or a typed lifecycle error.
   */
  archive(
    userReview: UserReview,
    archivedAt: IsoDateTimeString,
  ): UserReviewArchiveResult {
    if (!UserReview.canArchive(userReview)) {
      return {
        ok: false,
        error: { reason: "alreadyArchived", id: userReview.id },
      };
    }

    const archivedTimestamp = timestampOf(archivedAt);
    const updatedTimestamp = timestampOf(userReview.updatedAt);

    if (archivedTimestamp === null) {
      return {
        ok: false,
        error: { reason: "invalidTimestamp", id: userReview.id },
      };
    }

    if (updatedTimestamp === null || archivedTimestamp < updatedTimestamp) {
      return {
        ok: false,
        error: { reason: "archiveTimestampRollback", id: userReview.id },
      };
    }

    return {
      ok: true,
      userReview: {
        ...userReview,
        status: "archived",
        updatedAt: archivedAt,
        archivedAt,
      },
    };
  },

  /**
   * @param userReview - User review to inspect.
   * @returns True when the review belongs to the archived collection.
   */
  isArchived(userReview: UserReview): userReview is ArchivedUserReview {
    return UserReviewStatus.isArchived(userReview.status);
  },

  /**
   * @param userReview - User review to inspect.
   * @returns True when the review belongs to the active collection.
   */
  isNonArchived(userReview: UserReview): userReview is ActiveUserReview {
    return UserReviewStatus.isNonArchived(userReview.status);
  },
} as const;

/**
 * @param storedUserReview - Boundary value to validate.
 * @returns First aggregate invariant error, or null when valid.
 */
function validateStoredUserReview(
  storedUserReview: StoredUserReview,
): UserReviewRestoreError | null {
  const error = (
    reason: UserReviewRestoreErrorReason,
  ): UserReviewRestoreError => ({
    reason,
    id: storedUserReview.id,
  });

  if (storedUserReview.schemaVersion !== USER_REVIEW_SCHEMA_VERSION) {
    return error("unsupportedSchemaVersion");
  }

  if (!UserReviewStatus.isValid(storedUserReview.status)) {
    return error("invalidStatus");
  }

  if (!UserReviewTarget.isValid(storedUserReview.target)) {
    return error("invalidTarget");
  }

  if (
    !Number.isSafeInteger(storedUserReview.commentCount) ||
    storedUserReview.commentCount <= 0
  ) {
    return error("invalidCommentCount");
  }

  const createdTimestamp = timestampOf(storedUserReview.createdAt);
  const updatedTimestamp = timestampOf(storedUserReview.updatedAt);

  if (createdTimestamp === null || updatedTimestamp === null) {
    return error("invalidTimestamp");
  }

  if (updatedTimestamp < createdTimestamp) {
    return error("updatedBeforeCreated");
  }

  if (storedUserReview.status === "active") {
    if (storedUserReview.archivedAt !== null) {
      return error("activeHasArchivedAt");
    }

    if (storedUserReview.createdAt !== storedUserReview.updatedAt) {
      return error("activeTimestampsDiffer");
    }

    return null;
  }

  if (storedUserReview.archivedAt === null) {
    return error("archivedMissingArchivedAt");
  }

  if (timestampOf(storedUserReview.archivedAt) === null) {
    return error("invalidTimestamp");
  }

  if (storedUserReview.updatedAt !== storedUserReview.archivedAt) {
    return error("archivedTimestampsDiffer");
  }

  return null;
}

/**
 * @param value - Timestamp boundary value.
 * @returns Epoch milliseconds, or null when invalid.
 */
function timestampOf(value: IsoDateTimeString): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : timestamp;
}
