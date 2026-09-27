import type {
  GenerateLlmPromptRequest,
  GenerateLlmPromptResponse,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";
import { isRecord } from "./isRecord";

export const GenerateLlmPromptCommand = "generate_llm_prompt" as const;

export type GenerateLlmPromptCommandName = typeof GenerateLlmPromptCommand;
export type GenerateLlmPromptCommandRequest = GenerateLlmPromptRequest;
export type GenerateLlmPromptCommandResponse = GenerateLlmPromptResponse;
export type GenerateLlmPromptCommandErrorCode =
  | "invalidRequest"
  | "workspaceDetection"
  | "configLoad"
  | "markdownRead"
  | "invalidComment"
  | "commentRepository"
  | "unexpected"
  | "unknown";

export type GenerateLlmPromptCommandError = Readonly<{
  command: GenerateLlmPromptCommandName;
  code: GenerateLlmPromptCommandErrorCode;
  message: string;
  raw: unknown;
}>;

export type GenerateLlmPromptCommandContract = Readonly<{
  name: GenerateLlmPromptCommandName;
  request: GenerateLlmPromptCommandRequest;
  response: GenerateLlmPromptCommandResponse;
  error: GenerateLlmPromptCommandError;
}>;

export const GenerateLlmPromptCommandError = {
  /** @returns A command-specific generate_llm_prompt error parsed from an unknown value. */
  fromUnknown(error: unknown): GenerateLlmPromptCommandError {
    if (
      isRecord(error) &&
      error.command === GenerateLlmPromptCommand &&
      GenerateLlmPromptCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: GenerateLlmPromptCommand,
        code: error.code,
        message: error.message,
        raw: error.raw,
      };
    }

    if (
      isRecord(error) &&
      GenerateLlmPromptCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: GenerateLlmPromptCommand,
        code: error.code,
        message: error.message,
        raw: error,
      };
    }

    if (error instanceof Error) {
      return GenerateLlmPromptCommandError.unknown(error.message, error);
    }

    if (typeof error === "string") {
      return GenerateLlmPromptCommandError.unknown(error, error);
    }

    return GenerateLlmPromptCommandError.unknown(
      "Unknown generate_llm_prompt failure",
      error,
    );
  },

  /** @returns An unknown generate_llm_prompt command error preserving the raw payload. */
  unknown(message: string, raw: unknown): GenerateLlmPromptCommandError {
    return {
      command: GenerateLlmPromptCommand,
      code: "unknown",
      message,
      raw,
    };
  },

  /** @returns True when the value is a generate_llm_prompt command error code. */
  isCommandErrorCode(
    value: unknown,
  ): value is GenerateLlmPromptCommandErrorCode {
    return GenerateLlmPromptCommandError.isCode(value) || value === "unknown";
  },

  /** @returns True when the value is a known generate_llm_prompt backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<GenerateLlmPromptCommandErrorCode, "unknown"> {
    return (
      value === "invalidRequest" ||
      value === "workspaceDetection" ||
      value === "configLoad" ||
      value === "markdownRead" ||
      value === "invalidComment" ||
      value === "commentRepository" ||
      value === "unexpected"
    );
  },
} as const;

/** @returns A Markdown prompt bundle suitable for copying into an LLM chat. */
export async function generateLlmPrompt(
  request: GenerateLlmPromptRequest,
): Promise<GenerateLlmPromptCommandResponse> {
  const commandRequest: GenerateLlmPromptCommandRequest = request;

  return invokeTauriCommand<
    GenerateLlmPromptCommandResponse,
    GenerateLlmPromptCommandRequest,
    GenerateLlmPromptCommandError
  >(
    GenerateLlmPromptCommand,
    commandRequest,
    GenerateLlmPromptCommandError.fromUnknown,
  );
}
