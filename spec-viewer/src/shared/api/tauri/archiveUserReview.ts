import type {
  ArchiveUserReviewRequest,
  ArchiveUserReviewResponse,
} from "@/features/review-runs/types/userReviewIpc";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const ARCHIVE_USER_REVIEW_COMMAND = "archive_user_review" as const;

export type ArchiveUserReviewCommandName = typeof ARCHIVE_USER_REVIEW_COMMAND;
export type ArchiveUserReviewCommandRequest = ArchiveUserReviewRequest;
export type ArchiveUserReviewCommandResponse = ArchiveUserReviewResponse;
export type ArchiveUserReviewCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "invalidComment"
  | "commentRepository"
  | "userReviewExport"
  | "unexpected"
  | "unknown";

export type ArchiveUserReviewCommandError = Readonly<{
  command: ArchiveUserReviewCommandName;
  code: ArchiveUserReviewCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type ArchiveUserReviewCommandContract = Readonly<{
  name: ArchiveUserReviewCommandName;
  request: ArchiveUserReviewCommandRequest;
  response: ArchiveUserReviewCommandResponse;
  error: ArchiveUserReviewCommandError;
}>;

export const ArchiveUserReviewCommandError = {
  /** @returns A command-specific archive_user_review error parsed from an unknown value. */
  fromUnknown(error: unknown): ArchiveUserReviewCommandError {
    if (
      isRecord(error) &&
      ArchiveUserReviewCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: ARCHIVE_USER_REVIEW_COMMAND,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return ArchiveUserReviewCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return ArchiveUserReviewCommandError.unknown(error, error);
    }

    return ArchiveUserReviewCommandError.unknown(
      "Unknown archive_user_review failure",
      error,
    );
  },

  /** @returns An unknown archive_user_review command error preserving the raw payload. */
  unknown(message: string, raw: unknown): ArchiveUserReviewCommandError {
    return {
      command: ARCHIVE_USER_REVIEW_COMMAND,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a known archive_user_review backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<ArchiveUserReviewCommandErrorCode, "unknown"> {
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

/** @returns Metadata for the archived review run after moving it out of active. */
export async function archiveUserReview(
  request: ArchiveUserReviewRequest,
): Promise<ArchiveUserReviewCommandResponse> {
  const commandRequest: ArchiveUserReviewCommandRequest = request;

  return invokeTauriCommand<
    ArchiveUserReviewCommandResponse,
    ArchiveUserReviewCommandRequest,
    ArchiveUserReviewCommandError
  >(
    ARCHIVE_USER_REVIEW_COMMAND,
    commandRequest,
    ArchiveUserReviewCommandError.fromUnknown,
  );
}
