import type {
  CreateUserReviewRequest,
  CreateUserReviewResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const CREATE_USER_REVIEW_COMMAND = "create_user_review" as const;

export type CreateUserReviewCommandName = typeof CREATE_USER_REVIEW_COMMAND;
export type CreateUserReviewCommandRequest = CreateUserReviewRequest;
export type CreateUserReviewCommandResponse = CreateUserReviewResponse;
export type CreateUserReviewCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidComment"
  | "commentRepository"
  | "userReviewExport"
  | "unexpected"
  | "unknown";

export type CreateUserReviewCommandError = Readonly<{
  command: CreateUserReviewCommandName;
  code: CreateUserReviewCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type CreateUserReviewCommandContract = Readonly<{
  name: CreateUserReviewCommandName;
  request: CreateUserReviewCommandRequest;
  response: CreateUserReviewCommandResponse;
  error: CreateUserReviewCommandError;
}>;

export const CreateUserReviewCommandError = {
  /** @returns A command-specific create_user_review error parsed from an unknown value. */
  fromUnknown(error: unknown): CreateUserReviewCommandError {
    if (
      isRecord(error) &&
      CreateUserReviewCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: CREATE_USER_REVIEW_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return CreateUserReviewCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return CreateUserReviewCommandError.unknown(error, error);
    }

    return CreateUserReviewCommandError.unknown(
      "Unknown create_user_review failure",
      error,
    );
  },

  /** @returns An unknown create_user_review command error preserving the raw payload. */
  unknown(message: string, raw: unknown): CreateUserReviewCommandError {
    return {
      command: CREATE_USER_REVIEW_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a known create_user_review backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<CreateUserReviewCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "invalidComment" ||
      value === "commentRepository" ||
      value === "userReviewExport" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns Metadata for the active review run bundle created by the backend. */
export async function createUserReview(
  request: CreateUserReviewRequest,
): Promise<CreateUserReviewCommandResponse> {
  const commandRequest: CreateUserReviewCommandRequest = request;

  return invokeTauriCommand<
    CreateUserReviewCommandResponse,
    CreateUserReviewCommandRequest,
    CreateUserReviewCommandError
  >(
    CREATE_USER_REVIEW_COMMAND,
    commandRequest,
    CreateUserReviewCommandError.fromUnknown,
  );
}
