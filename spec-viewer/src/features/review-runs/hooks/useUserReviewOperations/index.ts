import type { UserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewListEvent } from "@/features/review-runs/domain/userReviewListState";
import type {
  UserReviewArchiveState as UserReviewArchiveStateType,
  UserReviewCreateState as UserReviewCreateStateType,
} from "@/features/review-runs/domain/userReviewOperation";
import type {
  UserReviewTarget,
  UserReviewTargetIdentity,
} from "@/features/review-runs/domain/userReviewTarget";
import {
  useArchiveUserReview,
  type UseArchiveUserReviewResult,
} from "@/features/review-runs/hooks/useArchiveUserReview";
import {
  useCreateUserReview,
  type CreateUserReviewInput,
  type UseCreateUserReviewResult,
} from "@/features/review-runs/hooks/useCreateUserReview";
import type { UserReviewCommands } from "@/shared/api/tauri";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type { CreateUserReviewInput };

export type UseUserReviewOperationsOptions = Readonly<{
  workspacePath: WorkspacePath | null;
  target: UserReviewTarget | null;
  targetIdentity: UserReviewTargetIdentity;
  commands: UserReviewCommands;
  onUserReviewEvent: (event: UserReviewListEvent) => void;
}>;

export type UseUserReviewOperationsResult = Readonly<{
  createState: UserReviewCreateStateType;
  archiveState: UserReviewArchiveStateType;
  createUserReview: (
    input: CreateUserReviewInput,
  ) => Promise<UserReview | null>;
  archiveUserReview: (userReviewId: string) => Promise<UserReview | null>;
}>;

/**
 * @param options - Active target, command boundary, and list event callback.
 * @returns User review create/archive states and operation callbacks.
 */
export function useUserReviewOperations(
  options: UseUserReviewOperationsOptions,
): UseUserReviewOperationsResult {
  const create: UseCreateUserReviewResult = useCreateUserReview(options);
  const archive: UseArchiveUserReviewResult = useArchiveUserReview(options);

  return {
    createState: create.createState,
    archiveState: archive.archiveState,
    createUserReview: create.createUserReview,
    archiveUserReview: archive.archiveUserReview,
  };
}
