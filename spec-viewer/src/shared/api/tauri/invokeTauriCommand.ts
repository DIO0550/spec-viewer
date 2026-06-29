import { invoke } from "@tauri-apps/api/core";

import type {
  CommandName,
  CommandRequest,
  CommandResponse,
  IpcCommandError,
} from "@/shared/types/ipc";

import { toIpcCommandError } from "./toIpcCommandError";

type CommandErrorMapper = (error: IpcCommandError) => IpcCommandError;

const identityCommandError: CommandErrorMapper = (error) => error;

/** @returns The typed response from the named Tauri command. */
export async function invokeTauriCommand<Name extends CommandName>(
  name: Name,
  request: CommandRequest<Name>,
  mapError: CommandErrorMapper = identityCommandError,
): Promise<CommandResponse<Name>> {
  try {
    return await invoke<CommandResponse<Name>>(name, { request });
  } catch (error) {
    throw mapError(toIpcCommandError(error));
  }
}
