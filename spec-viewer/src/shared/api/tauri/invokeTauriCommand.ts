import { invoke } from "@tauri-apps/api/core";

type CommandErrorFactory<CommandError> = (error: unknown) => CommandError;
type ResponseDecoder<Response> = (response: unknown) => Response;

type InvokeTauriCommandOptions<Response, Request, CommandError> = Readonly<{
  name: string;
  request: Request;
  decodeResponse: ResponseDecoder<Response>;
  createError: CommandErrorFactory<CommandError>;
}>;

export function invokeTauriCommand<Response, Request, CommandError>(
  options: InvokeTauriCommandOptions<Response, Request, CommandError>,
): Promise<Response>;
export function invokeTauriCommand<Response, Request, CommandError>(
  name: string,
  request: Request,
  createError: CommandErrorFactory<CommandError>,
  decodeResponse: ResponseDecoder<Response>,
): Promise<Response>;

/** @returns A decoded success response or a command-local rejection. */
export async function invokeTauriCommand<Response, Request, CommandError>(
  optionsOrName:
    | InvokeTauriCommandOptions<Response, Request, CommandError>
    | string,
  request?: Request,
  createError?: CommandErrorFactory<CommandError>,
  decodeResponse?: ResponseDecoder<Response>,
): Promise<Response> {
  const options =
    typeof optionsOrName === "string"
      ? positionalOptions(optionsOrName, request, createError, decodeResponse)
      : optionsOrName;
  let response: unknown;

  try {
    response = await invoke<unknown>(options.name, {
      request: options.request,
    });
  } catch (error) {
    throw options.createError(error);
  }

  return options.decodeResponse(response);
}

function positionalOptions<Response, Request, CommandError>(
  name: string,
  request: Request | undefined,
  createError: CommandErrorFactory<CommandError> | undefined,
  decodeResponse: ResponseDecoder<Response> | undefined,
): InvokeTauriCommandOptions<Response, Request, CommandError> {
  if (
    request === undefined ||
    createError === undefined ||
    decodeResponse === undefined
  ) {
    throw new Error(`Incomplete Tauri command boundary: ${name}`);
  }

  return { name, request, createError, decodeResponse };
}
