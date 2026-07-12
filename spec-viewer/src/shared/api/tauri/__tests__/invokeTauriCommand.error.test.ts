import { invoke } from "@tauri-apps/api/core";
import { expect, test, vi } from "vitest";

import { invokeTauriCommand } from "@/shared/api/tauri/invokeTauriCommand";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

test("invokeTauriCommandはreject errorをcommand-local error factoryで変換する", async () => {
  const rawError = { code: "invalidRequest", message: "Bad request" };
  const createError = vi.fn((error: unknown) => ({
    command: "example_command" as const,
    code: "invalidRequest" as const,
    message: "Mapped request failure",
    raw: error,
  }));
  invokeMock.mockReset();
  invokeMock.mockRejectedValue(rawError);

  await expect(
    invokeTauriCommand<
      Readonly<{ ok: true }>,
      Readonly<{ id: string }>,
      ReturnType<typeof createError>
    >({
      name: "example_command",
      request: { id: "1" },
      decodeResponse: (response) => response as Readonly<{ ok: true }>,
      createError,
    }),
  ).rejects.toEqual({
    command: "example_command",
    code: "invalidRequest",
    message: "Mapped request failure",
    raw: rawError,
  });
  expect(createError).toHaveBeenCalledWith(rawError);
});

test("invokeTauriCommandはunknown successをdecoderへ渡す", async () => {
  const rawResponse = { ok: true };
  const decodeResponse = vi.fn(() => ({ value: "decoded" }));
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(rawResponse);

  await expect(
    invokeTauriCommand({
      name: "example_command",
      request: { id: "1" },
      decodeResponse,
      createError: (error) => error,
    }),
  ).resolves.toEqual({ value: "decoded" });
  expect(decodeResponse).toHaveBeenCalledWith(rawResponse);
});
