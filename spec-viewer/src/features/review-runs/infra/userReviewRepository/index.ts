import type {
  UserReviewRepository,
  UserReviewRepositoryError,
  UserReviewRepositoryErrorCode,
  UserReviewRepositoryResult,
} from "@/features/review-runs/application/ports/userReviewRepository";
import {
  archiveUserReview,
  createUserReview,
  listUserReviews,
  UserReviewGatewayResponseMismatchError,
  UserReviewMutationRestoreError,
} from "@/features/review-runs/infra/userReviewGateway";
import {
  UserReviewDtoRestoreError,
  UserReviewIpcCodecError,
  UserReviewListRestoreError,
} from "@/features/review-runs/infra/userReviewIpcAdapter";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

/**
 * @param commands - Tauri user-review command boundary.
 * @returns Repository adapter that converts transport failures to typed outcomes.
 */
export function createTauriUserReviewRepository(
  commands: UserReviewCommands,
): UserReviewRepository {
  return {
    list: async (input) => {
      try {
        const value = await listUserReviews(
          commands,
          WorkspacePath.toString(input.workspacePath),
          input.target,
          input.correlationId,
        );
        return success(value);
      } catch (error) {
        return failure(error);
      }
    },
    create: async (command) => {
      try {
        const value = await createUserReview(commands, command);
        return success(value.userReview);
      } catch (error) {
        return failure(error);
      }
    },
    archive: async (input) => {
      try {
        const value = await archiveUserReview(
          commands,
          WorkspacePath.toString(input.workspacePath),
          input.userReview,
        );
        return success(value.userReview);
      } catch (error) {
        return failure(error);
      }
    },
  };
}

/** @returns Successful repository outcome. */
function success<T>(value: T): UserReviewRepositoryResult<T> {
  return { ok: true, value };
}

/** @returns Failed repository outcome from an infrastructure exception. */
function failure<T>(error: unknown): UserReviewRepositoryResult<T> {
  return { ok: false, error: toRepositoryError(error) };
}

/** @returns Stable repository error preserving backend codes when available. */
function toRepositoryError(error: unknown): UserReviewRepositoryError {
  if (isInvalidUserReviewBoundaryError(error)) {
    return {
      code: "invalidUserReview",
      message: error.message,
      cause: error,
    };
  }

  const rawBackendError = findKnownBackendError(error);
  if (rawBackendError !== null) {
    return {
      code: rawBackendError.code,
      message: rawBackendError.message,
      cause: error,
    };
  }

  if (isErrorRecord(error)) {
    return {
      code: normalizeErrorCode(error.code),
      message: error.message,
      cause: error,
    };
  }

  if (error instanceof Error) {
    return { code: "unknown", message: error.message, cause: error };
  }

  if (typeof error === "string") {
    return { code: "unknown", message: error, cause: error };
  }

  return {
    code: "unknown",
    message: "Unknown user review repository failure",
    cause: error,
  };
}

/** @returns A known backend error found in a normalized error chain. */
function findKnownBackendError(
  error: unknown,
  seen: Set<object> = new Set(),
): Readonly<{ code: UserReviewRepositoryErrorCode; message: string }> | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  if (seen.has(error)) {
    return null;
  }
  seen.add(error);

  if (isErrorRecord(error)) {
    const code = normalizeErrorCode(error.code);
    if (code !== "unknown") {
      return {
        code,
        message: error.message,
      };
    }
  }

  const rawBackendError =
    "raw" in error ? findKnownBackendError(error.raw, seen) : null;
  if (rawBackendError !== null) {
    return rawBackendError;
  }

  return "cause" in error ? findKnownBackendError(error.cause, seen) : null;
}

/** @returns True for typed DTO, restore and response-correlation failures. */
function isInvalidUserReviewBoundaryError(error: unknown): error is Error {
  return (
    error instanceof UserReviewIpcCodecError ||
    error instanceof UserReviewDtoRestoreError ||
    error instanceof UserReviewListRestoreError ||
    error instanceof UserReviewMutationRestoreError ||
    error instanceof UserReviewGatewayResponseMismatchError
  );
}

/** @returns True for a backend error object with a display message. */
function isErrorRecord(
  error: unknown,
): error is Readonly<{ code: unknown; message: string }> {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.message === "string"
  );
}

/** @returns Backend-aligned repository code or unknown. */
function normalizeErrorCode(code: unknown): UserReviewRepositoryErrorCode {
  if (repositoryErrorCodes.has(code as UserReviewRepositoryErrorCode)) {
    return code as UserReviewRepositoryErrorCode;
  }

  return "unknown";
}

const repositoryErrorCodes: ReadonlySet<UserReviewRepositoryErrorCode> =
  new Set([
    "invalidRequest",
    "workspaceDetection",
    "configLoad",
    "invalidSpec",
    "invalidComment",
    "commentRepository",
    "invalidUserReview",
    "userReviewCollision",
    "userReviewRepository",
    "userReviewExport",
    "unexpected",
    "unknown",
  ]);
