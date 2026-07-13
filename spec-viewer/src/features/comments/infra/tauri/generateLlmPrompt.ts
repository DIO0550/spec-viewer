import type {
  GenerateLlmPromptRequest,
  GenerateLlmPromptResponse,
} from "@/features/comments/types/comment";
import {
  decodeGenerateLlmPromptResponse,
  encodeGenerateLlmPromptRequest,
} from "@/features/comments/infra/tauri/commentIpcCodec";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";
import { isRecord } from "@/shared/lib/isRecord";

export const GENERATE_LLM_PROMPT_COMMAND = "generate_llm_prompt" as const;

export type GenerateLlmPromptCommandName = typeof GENERATE_LLM_PROMPT_COMMAND;
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
  | "invalidResponse"
  | "unknown";

export type GenerateLlmPromptCommandError = Readonly<{
  command: GenerateLlmPromptCommandName;
  code: GenerateLlmPromptCommandErrorCode;
  message: string;
  cause: unknown;
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
      error.command === GENERATE_LLM_PROMPT_COMMAND &&
      GenerateLlmPromptCommandError.isCommandErrorCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: GENERATE_LLM_PROMPT_COMMAND,
        code: error.code,
        message: error.message,
        cause: "cause" in error ? error.cause : error,
      };
    }

    if (
      isRecord(error) &&
      GenerateLlmPromptCommandError.isCode(error.code) &&
      typeof error.message === "string"
    ) {
      return {
        command: GENERATE_LLM_PROMPT_COMMAND,
        code: error.code,
        message: error.message,
        cause: error,
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

  /** @returns An unknown generate_llm_prompt command error preserving the cause payload. */
  unknown(message: string, cause: unknown): GenerateLlmPromptCommandError {
    return {
      command: GENERATE_LLM_PROMPT_COMMAND,
      code: "unknown",
      message,
      cause,
    };
  },

  /** @returns True when the value is a generate_llm_prompt command error code. */
  isCommandErrorCode(
    value: unknown,
  ): value is GenerateLlmPromptCommandErrorCode {
    return (
      GenerateLlmPromptCommandError.isCode(value) ||
      value === "invalidResponse" ||
      value === "unknown"
    );
  },

  /** @returns True when the value is a known generate_llm_prompt backend error code. */
  isCode(
    value: unknown,
  ): value is Exclude<
    GenerateLlmPromptCommandErrorCode,
    "unknown" | "invalidResponse"
  > {
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
    ReturnType<typeof encodeGenerateLlmPromptRequest>,
    GenerateLlmPromptCommandError
  >(
    GENERATE_LLM_PROMPT_COMMAND,
    encodeGenerateLlmPromptRequest(commandRequest),
    GenerateLlmPromptCommandError.fromUnknown,
    decodeGenerateLlmPromptResponse,
  );
}
