import type {
  UserReviewRepository,
  UserReviewRepositoryError,
} from "@/features/review-runs/application/ports/userReviewRepository";
import {
  CreateUserReviewCommand,
  type CreateUserReviewCommand as CreateUserReviewCommandType,
  type CreateUserReviewCommandInput,
  type CreateUserReviewCommandResult,
} from "@/features/review-runs/domain/createUserReviewCommand";
import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import {
  UserReviewCollection,
  type UserReviewCollection as UserReviewCollectionType,
} from "@/features/review-runs/domain/userReviewCollection";
import type { UserReviewFeatureError } from "@/features/review-runs/domain/userReviewError";
import {
  UserReviewTarget,
  type UserReviewTarget as UserReviewTargetType,
} from "@/features/review-runs/domain/userReviewTarget";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type ListUserReviewsUseCaseInput = Readonly<{
  workspacePath: WorkspacePath;
  target: UserReviewTargetType;
  correlationId: string | null;
}>;

export type ListUserReviewsUseCaseOutcome =
  | Readonly<{
      status: "listed";
      collection: UserReviewCollectionType;
    }>
  | Readonly<{
      status: "failed";
      error: UserReviewFeatureError;
    }>;

export type CreateUserReviewUseCaseOutcome =
  | Readonly<{
      status: "created";
      userReview: ActiveUserReview;
    }>
  | Readonly<{
      status: "failed";
      error: UserReviewFeatureError;
    }>;

export type ArchiveUserReviewPreparationInput = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTargetType | null;
  userReview: ActiveUserReview;
}>;

export type ArchiveUserReviewCommand = Readonly<{
  workspacePath: WorkspacePath;
  userReview: ActiveUserReview;
}>;

export type ArchiveUserReviewPreparationResult =
  | Readonly<{ ok: true; command: ArchiveUserReviewCommand }>
  | Readonly<{
      ok: false;
      reason: "missingWorkspace" | "missingTarget" | "targetMismatch";
    }>;

export type ArchiveUserReviewUseCaseOutcome =
  | Readonly<{
      status: "archived";
      userReview: ArchivedUserReview;
    }>
  | Readonly<{
      status: "failed";
      error: UserReviewFeatureError;
    }>;

export type PreparedCreateUserReview = Extract<
  CreateUserReviewCommandResult,
  { ok: true }
>;

export type UserReviewUseCases = Readonly<{
  /** @returns A validated create command or eligibility failure. */
  prepareCreate: (
    input: CreateUserReviewCommandInput,
  ) => CreateUserReviewCommandResult;
  /** @returns Whether create input satisfies domain eligibility. */
  canCreate: (input: CreateUserReviewCommandInput) => boolean;
  /** @returns Reviews listed through the repository port. */
  list: (
    input: ListUserReviewsUseCaseInput,
  ) => Promise<ListUserReviewsUseCaseOutcome>;
  /** @returns A created review or typed application failure. */
  create: (
    command: CreateUserReviewCommandType,
  ) => Promise<CreateUserReviewUseCaseOutcome>;
  /** @returns A validated archive command or lifecycle failure. */
  prepareArchive: (
    input: ArchiveUserReviewPreparationInput,
  ) => ArchiveUserReviewPreparationResult;
  /** @returns An archived review or typed application failure. */
  archive: (
    command: ArchiveUserReviewCommand,
  ) => Promise<ArchiveUserReviewUseCaseOutcome>;
}>;

/**
 * @param repository - User review persistence port.
 * @returns React- and Tauri-independent list/create/archive use cases.
 */
export function createUserReviewUseCases(
  repository: UserReviewRepository,
): UserReviewUseCases {
  return {
    prepareCreate: CreateUserReviewCommand.create,
    canCreate: (input): boolean => CreateUserReviewCommand.create(input).ok,
    list: async (input): Promise<ListUserReviewsUseCaseOutcome> => {
      const result = await repository.list(input);

      if (!result.ok) {
        return failure(result.error);
      }

      return {
        status: "listed",
        collection: UserReviewCollection.fromListResponse(
          result.value.active,
          result.value.archived,
          result.value.problems,
        ),
      };
    },
    create: async (command): Promise<CreateUserReviewUseCaseOutcome> => {
      const result = await repository.create(command);

      if (!result.ok) {
        return failure(result.error);
      }

      return { status: "created", userReview: result.value };
    },
    prepareArchive: (input): ArchiveUserReviewPreparationResult => {
      if (input.workspacePath === null) {
        return { ok: false, reason: "missingWorkspace" };
      }

      if (input.target === null) {
        return { ok: false, reason: "missingTarget" };
      }

      if (!UserReviewTarget.equals(input.target, input.userReview.target)) {
        return { ok: false, reason: "targetMismatch" };
      }

      return {
        ok: true,
        command: {
          workspacePath: input.workspacePath,
          userReview: input.userReview,
        },
      };
    },
    archive: async (command): Promise<ArchiveUserReviewUseCaseOutcome> => {
      const result = await repository.archive(command);

      if (!result.ok) {
        return failure(result.error);
      }

      return { status: "archived", userReview: result.value };
    },
  };
}

/**
 * @param error - Typed repository failure.
 * @returns Application failure preserving the backend error contract.
 */
function failure(error: UserReviewRepositoryError): Readonly<{
  status: "failed";
  error: UserReviewFeatureError;
}> {
  return {
    status: "failed",
    error: {
      feature: "userReviews",
      code: error.code,
      message: error.message,
      cause: error.cause,
    },
  };
}
