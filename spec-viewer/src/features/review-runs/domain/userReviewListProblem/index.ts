export type UserReviewListProblemState = "malformed" | "missingFolder";

export type UserReviewListProblem = Readonly<{
  folderPath: string;
  state: UserReviewListProblemState;
  message: string;
}>;
