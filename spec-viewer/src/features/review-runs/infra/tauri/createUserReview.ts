import type {
  CreateUserReviewRequest,
  CreateUserReviewResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const CREATE_USER_REVIEW_COMMAND = "create_user_review" as const;

export type CreateUserReviewCommandName = typeof CREATE_USER_REVIEW_COMMAND;
export type CreateUserReviewCommandRequest = CreateUserReviewRequest;
export type CreateUserReviewCommandResponse = CreateUserReviewResponse;
export type CreateUserReviewCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidSpec"
  | "invalidComment"
  | "commentRepository"
  | "userReviewExport"
  | "unexpected"
  | "unknown";

export type CreateUserReviewCommandError = Readonly<{
  command: CreateUserReviewCommandName;
  code: CreateUserReviewCommandErrorCode;
  message: string;
  cause: unknown;
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
      error.command === CREATE_USER_REVIEW_COMMAND &&
      CreateUserReviewCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: CREATE_USER_REVIEW_COMMAND,
        code: error.code,
        message: error.message,
        cause: error.cause,
      };
    }

    if (
      isRecord(error) &&
      CreateUserReviewCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: CREATE_USER_REVIEW_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
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

  /** @returns An unknown create_user_review command error preserving the cause payload. */
  unknown(message: string, cause: unknown): CreateUserReviewCommandError {
    return {
      command: CREATE_USER_REVIEW_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a create_user_review command error code. */
  isCommandErrorCode(
    value: unknown,
  ): value is CreateUserReviewCommandErrorCode {
    return CreateUserReviewCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known create_user_review backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<CreateUserReviewCommandErrorCode, "unknown"> {
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
