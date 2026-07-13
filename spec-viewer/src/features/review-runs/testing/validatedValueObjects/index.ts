import {
  UserReviewId,
  type UserReviewId as UserReviewIdType,
} from "@/features/review-runs/domain/userReviewId";

export {
  commentId,
  isoDateTime,
  specId,
} from "@/shared/testing/validatedValueObjects";

/**
 * @param value - Raw UserReviewId fixture.
 * @returns A validated UserReviewId fixture restored with production rules.
 * @throws Error when the fixture violates production restoration rules.
 */
export const userReviewId = (value: string): UserReviewIdType => {
  const result = UserReviewId.fromDto(value);
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.value;
};
