import type {
  GenerateLlmPromptRequest,
  GenerateLlmPromptResponse,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns A Markdown prompt bundle suitable for copying into an LLM chat. */
export async function generateLlmPrompt(
  request: GenerateLlmPromptRequest,
): Promise<GenerateLlmPromptResponse> {
  return invokeTauriCommand("generate_llm_prompt", request);
}
