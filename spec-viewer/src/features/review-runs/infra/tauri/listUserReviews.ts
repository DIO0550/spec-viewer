import type {
  ListUserReviewsRequest,
  ListUserReviewsResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const LIST_USER_REVIEWS_COMMAND = "list_user_reviews" as const;

export type ListUserReviewsCommandName = typeof LIST_USER_REVIEWS_COMMAND;
export type ListUserReviewsCommandRequest = ListUserReviewsRequest;
export type ListUserReviewsCommandResponse = ListUserReviewsResponse;
export type ListUserReviewsCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidSpec"
  | "invalidComment"
  | "commentRepository"
  | "userReviewExport"
  | "unexpected"
  | "unknown";

export type ListUserReviewsCommandError = Readonly<{
  command: ListUserReviewsCommandName;
  code: ListUserReviewsCommandErrorCode;
  message: string;
  cause: unknown;
}>;

export type ListUserReviewsCommandContract = Readonly<{
  name: ListUserReviewsCommandName;
  request: ListUserReviewsCommandRequest;
  response: ListUserReviewsCommandResponse;
  error: ListUserReviewsCommandError;
}>;

export const ListUserReviewsCommandError = {
  /** @returns A command-specific list_user_reviews error parsed from an unknown value. */
  fromUnknown(error: unknown): ListUserReviewsCommandError {
    if (
      isRecord(error) &&
      error.command === LIST_USER_REVIEWS_COMMAND &&
      ListUserReviewsCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_USER_REVIEWS_COMMAND,
        code: error.code,
        message: error.message,
        cause: error.cause,
      };
    }

    if (
      isRecord(error) &&
      ListUserReviewsCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: LIST_USER_REVIEWS_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
      };
    }

    if (error instanceof Error) {
      return ListUserReviewsCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ListUserReviewsCommandError.unknown(error, error);
    }

    return ListUserReviewsCommandError.unknown(
      "Unknown list_user_reviews failure",
      error,
    );
  },

  /** @returns An unknown list_user_reviews command error preserving the cause payload. */
  unknown(message: string, cause: unknown): ListUserReviewsCommandError {
    return {
      command: LIST_USER_REVIEWS_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a list_user_reviews command error code. */
  isCommandErrorCode(value: unknown): value is ListUserReviewsCommandErrorCode {
    return ListUserReviewsCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known list_user_reviews backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ListUserReviewsCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "invalidSpec" ||
      value === "invalidComment" ||
      value === "commentRepository" ||
      value === "userReviewExport" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Active and archived review runs for the selected review target. */
export async function listUserReviews(
  request: ListUserReviewsRequest,
): Promise<ListUserReviewsCommandResponse> {
  const commandRequest: ListUserReviewsCommandRequest = request;

  return invokeTauriCommand<
    ListUserReviewsCommandResponse,
    ListUserReviewsCommandRequest,
    ListUserReviewsCommandError
  >(
    LIST_USER_REVIEWS_COMMAND,
    commandRequest,
    ListUserReviewsCommandError.fromUnknown,
  );
}
