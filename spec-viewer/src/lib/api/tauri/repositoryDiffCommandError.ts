import type { InvalidDiffResponseError } from "./diffPayloadDecoder";
import {
  GIT_BACKEND_ERROR_CODES,
  type GitBackendErrorCode,
} from "./gitBackendErrorCode";
import { isRecord } from "./isRecord";

/** Codes only the repository commands raise: override validation and cursor paging. */
export const REPOSITORY_ONLY_ERROR_CODES = [
  "invalidOverride",
  "staleCursor",
  "invalidCursor",
] as const;

/** Every `RepositoryCommandError.code` the backend emits (21 shared + 3 repository-only). */
export type RepositoryBackendErrorCode =
  | GitBackendErrorCode
  | (typeof REPOSITORY_ONLY_ERROR_CODES)[number];

export const REPOSITORY_BACKEND_ERROR_CODES = [
  ...GIT_BACKEND_ERROR_CODES,
  ...REPOSITORY_ONLY_ERROR_CODES,
] as const satisfies readonly RepositoryBackendErrorCode[];

export type RepositoryCommandErrorCode =
  | RepositoryBackendErrorCode
  | "invalidResponse"
  | "unknown";

export type RepositoryCommandErrorOf<Name extends string> = Readonly<{
  command: Name;
  code: RepositoryCommandErrorCode;
  message: string;
  raw: unknown;
}>;

/**
 * @param value - Value to test.
 * @returns True for each of the 24 backend error codes.
 */
export function isRepositoryBackendErrorCode(
  value: unknown,
): value is RepositoryBackendErrorCode {
  return (
    typeof value === "string" &&
    REPOSITORY_BACKEND_ERROR_CODES.includes(value as RepositoryBackendErrorCode)
  );
}

/**
 * @param value - Value to test.
 * @returns True for backend codes plus the two command-local codes.
 */
export function isRepositoryCommandErrorCode(
  value: unknown,
): value is RepositoryCommandErrorCode {
  return (
    isRepositoryBackendErrorCode(value) ||
    value === "invalidResponse" ||
    value === "unknown"
  );
}

export type RepositoryCommandErrorCompanion<Name extends string> = Readonly<{
  /**
   * Normalizes an unknown rejected IPC payload.
   *
   * @param error - The rejected value.
   * @returns A normalized command error.
   */
  fromUnknown: (error: unknown) => RepositoryCommandErrorOf<Name>;
  /**
   * Converts a runtime response-validation failure into a command error.
   *
   * @param error - The decoder failure.
   * @returns A command-local invalidResponse error.
   */
  invalidResponse: (
    error: InvalidDiffResponseError,
  ) => RepositoryCommandErrorOf<Name>;
  /**
   * Builds the fallback error for values that carry no usable code.
   *
   * @param message - Fallback failure message.
   * @param raw - The original rejected value.
   * @returns An unknown command error.
   */
  unknown: (message: string, raw: unknown) => RepositoryCommandErrorOf<Name>;
}>;

/**
 * Builds the error companion shared by the three repository commands.
 *
 * The backend's reject payload carries only `{ code, message }` — never a
 * `command` field — so normalization keys off the code and message alone.
 *
 * @param command - The IPC command name to stamp onto normalized errors.
 * @returns A companion with `fromUnknown`, `invalidResponse` and `unknown`.
 */
export function createRepositoryCommandErrorCompanion<Name extends string>(
  command: Name,
): RepositoryCommandErrorCompanion<Name> {
  /**
   * @param message - Fallback failure message.
   * @param raw - The original rejected value.
   * @returns An unknown command error.
   */
  function unknown(
    message: string,
    raw: unknown,
  ): RepositoryCommandErrorOf<Name> {
    return { command, code: "unknown", message, raw };
  }

  return {
    fromUnknown(error: unknown): RepositoryCommandErrorOf<Name> {
      if (
        isRecord(error) &&
        isRepositoryCommandErrorCode(error.code) &&
        typeof error.message === "string"
      ) {
        return {
          command,
          code: error.code,
          message: error.message,
          raw: error,
        };
      }

      if (error instanceof Error) {
        return unknown(error.message, error);
      }
      if (typeof error === "string") {
        return unknown(error, error);
      }

      return unknown(`Unknown ${command} failure`, error);
    },

    invalidResponse(
      error: InvalidDiffResponseError,
    ): RepositoryCommandErrorOf<Name> {
      return {
        command,
        code: "invalidResponse",
        message: error.message,
        raw: error.raw,
      };
    },

    unknown,
  };
}
