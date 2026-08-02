import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";
import { useSpecs } from "@/features/specs/hooks/useSpecs";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";
import type { SpecCommands } from "@/lib/api/tauri";

const commands = vi.hoisted(() => ({
  listSpecs: vi.fn<SpecCommands["listSpecs"]>(),
  readSpecFile: vi.fn<SpecCommands["readSpecFile"]>(),
  archiveSpec: vi.fn<SpecCommands["archiveSpec"]>(),
}));

vi.mock("@/lib/api/tauri", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/tauri")>();
  return { ...actual, specCommands: commands };
});

beforeEach(() => {
  commands.listSpecs.mockReset();
  commands.readSpecFile.mockReset();
  commands.archiveSpec.mockReset();
});

test("selectSpecFileはspec/fileを原子的に更新しcallbackとdocument readを各1回行う", async () => {
  commands.listSpecs.mockResolvedValue({
    specs: [
      createSpecNodeFixture({
        id: "first",
        label: "First",
        files: [
          {
            key: "impl",
            label: "Implementation",
            fileName: "implementation-plan.md",
            status: "present",
          },
        ],
      }),
      createSpecNodeFixture({
        id: "target",
        label: "Target",
        files: [
          {
            key: "tasks",
            label: "Tasks",
            fileName: "tasks.md",
            status: "present",
          },
        ],
      }),
    ],
  });
  commands.readSpecFile.mockImplementation(async (request) => ({
    key: request.fileKey,
    path: `${request.specId}/${request.fileKey}.md`,
    contents: "# document",
    missing: false,
    blocks: [],
  }));
  const onSelectionChange = vi.fn();
  const hook = renderHook(() =>
    useSpecs({ workspacePath: "/workspace", onSelectionChange }),
  );
  await flush();
  onSelectionChange.mockClear();
  commands.readSpecFile.mockClear();

  await act(async () => {
    await hook.current().actions.selectSpecFile("target", "tasks");
  });

  expect(hook.current().state.selection).toEqual({
    specId: "target",
    fileKey: "tasks",
  });
  expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith({
    workspacePath: "/workspace",
    specId: "target",
    fileKey: "tasks",
  });
  expect(commands.readSpecFile).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ specId: "target", fileKey: "tasks" }),
  );
  hook.unmount();
});

test.each([
  ["missing-spec", "tasks"],
  ["target", "unknown-key"],
] as const)("存在しないspec/file selectionはno-opになる", async (specId, fileKey) => {
  commands.listSpecs.mockResolvedValue({
    specs: [
      createSpecNodeFixture({
        id: "target",
        label: "Target",
        files: [
          {
            key: "tasks",
            label: "Tasks",
            fileName: "tasks.md",
            status: "present",
          },
        ],
      }),
    ],
  });
  commands.readSpecFile.mockImplementation(async (request) => ({
    key: request.fileKey,
    path: "tasks.md",
    contents: "# Tasks",
    missing: false,
    blocks: [],
  }));
  const onSelectionChange = vi.fn();
  const hook = renderHook(() =>
    useSpecs({ workspacePath: "/workspace", onSelectionChange }),
  );
  await flush();
  onSelectionChange.mockClear();
  commands.readSpecFile.mockClear();

  await act(async () => {
    await hook.current().actions.selectSpecFile(specId, fileKey);
  });

  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(commands.readSpecFile).not.toHaveBeenCalled();
  hook.unmount();
});

function renderHook<Result>(hook: () => Result): Readonly<{
  current: () => Result;
  unmount: () => void;
}> {
  const root = createRoot(document.createElement("div"));
  const result = { current: undefined as Result };
  function TestComponent(): null {
    result.current = hook();
    return null;
  }
  act(() => root.render(<TestComponent />));
  return {
    current: () => result.current,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
