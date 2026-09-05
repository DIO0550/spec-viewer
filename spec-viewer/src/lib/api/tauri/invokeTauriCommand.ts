import { invoke } from "@tauri-apps/api/core";

type CommandErrorFactory<CommandError> = (error: unknown) => CommandError;

/**
 * @param name - Tauri command name to invoke.
 * @param request - Command-local request payload.
 * @param createError - Command-local parser for rejected IPC payloads.
 * @returns The typed response from the named Tauri command.
 * @throws The command-local error returned by createError when invoke rejects.
 */
export async function invokeTauriCommand<Response, Request, CommandError>(
  name: string,
  request: Request,
  createError: CommandErrorFactory<CommandError>,
): Promise<Response> {
  try {
    return await invoke<Response>(name, { request });
  } catch (error) {
    throw createError(error);
  }
}
