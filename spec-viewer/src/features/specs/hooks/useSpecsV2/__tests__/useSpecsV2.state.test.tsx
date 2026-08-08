import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";

import { useSpecs } from "@/features/specs/hooks/useSpecs";
import type { SpecBundle, SpecTree } from "@/features/specs/types/spec";
import type { SpecCommands } from "@/lib/api/tauri";

const commands = vi.hoisted(() => ({
  listSpecs: vi.fn<SpecCommands["listSpecs"]>(),
  loadSpecBundle: vi.fn<SpecCommands["loadSpecBundle"]>(),
  readSpecFile: vi.fn<SpecCommands["readSpecFile"]>(),
  archiveSpec: vi.fn<SpecCommands["archiveSpec"]>(),
}));

vi.mock("@/lib/api/tauri", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/api/tauri")>()),
  specCommands: commands,
}));

const tree: SpecTree = {
  specs: [
    {
      id: "spec-1",
      label: "Spec 1",
      kind: "spec",
      sourceGroupId: "primary",
      relativeId: "spec-1",
      presentDocumentCount: 2,
      descendantSpecCount: 0,
      progress: "inProgress",
      files: [
        {
          key: "impl",
          label: "Implementation",
          fileName: "implementation-plan.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const bundle: SpecBundle = {
  specId: "spec-1",
  progress: "inProgress",
  artifacts: [
    {
      identity: { kind: "standard", fileKey: "impl" },
      fileKey: "impl",
      fileName: "implementation-plan.md",
      label: "Implementation",
      format: "markdown",
      progress: "completed",
      path: ".plugin-workspace/.specs/spec-1/implementation-plan.md",
      contents: "# Plan",
      blocks: [],
      error: null,
    },
    {
      identity: { kind: "directMarkdown", fileName: "Notes.md" },
      fileKey: null,
      fileName: "Notes.md",
      label: "Notes",
      format: "markdown",
      progress: "unknown",
      path: ".plugin-workspace/.specs/spec-1/Notes.md",
      contents: null,
      blocks: [],
      error: { code: "markdownRead", message: "Could not read artifact." },
    },
  ],
};

type HookResult = Readonly<{
  current: ReturnType<typeof useSpecs>;
  unmount: () => void;
}>;

function renderSpecs(): HookResult {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = {
    current: undefined as unknown as ReturnType<typeof useSpecs>,
  };

  function TestComponent(): null {
    result.current = useSpecs({ workspacePath: "/workspace/spec-viewer" });
    return null;
  }

  act(() => root.render(<TestComponent />));
  return {
    get current() {
      return result.current;
    },
    unmount: () => act(() => root.unmount()),
  };
}

async function flushLoads(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 6; index += 1) {
      await Promise.resolve();
    }
  });
}

beforeEach(() => {
  commands.listSpecs.mockReset();
  commands.loadSpecBundle.mockReset();
  commands.readSpecFile.mockReset();
  commands.archiveSpec.mockReset();
});

test("workspace loadはtree後にfirst spec bundleを1回だけ読む", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockResolvedValue(bundle);
  const result = renderSpecs();

  await flushLoads();

  expect(commands.listSpecs).toHaveBeenCalledOnce();
  expect(commands.loadSpecBundle).toHaveBeenCalledOnce();
  expect(commands.loadSpecBundle).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-viewer",
    specId: "spec-1",
  });
  expect(commands.readSpecFile).not.toHaveBeenCalled();
  expect(result.current.state.selection.artifactIdentity).toEqual({
    kind: "standard",
    fileKey: "impl",
  });
  expect(result.current.state.bundleState.status).toBe("partialError");
  result.unmount();
});

test("artifact tab切替はbundle内projectionだけを変更してIPCを増やさない", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockResolvedValue(bundle);
  const result = renderSpecs();
  await flushLoads();

  act(() => {
    result.current.actions.selectArtifact({
      kind: "directMarkdown",
      fileName: "Notes.md",
    });
  });

  expect(result.current.state.selection.artifactIdentity).toEqual({
    kind: "directMarkdown",
    fileName: "Notes.md",
  });
  expect(result.current.state.selection.fileKey).toBeNull();
  expect(result.current.selectors.selectedArtifact?.error?.code).toBe(
    "markdownRead",
  );
  expect(commands.loadSpecBundle).toHaveBeenCalledOnce();
  expect(commands.readSpecFile).not.toHaveBeenCalled();
  result.unmount();
});

test("reloadはerror artifact identityも維持し、消失時だけ先頭へfallbackする", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockResolvedValue(bundle);
  const result = renderSpecs();
  await flushLoads();
  act(() => {
    result.current.actions.selectArtifact({
      kind: "directMarkdown",
      fileName: "Notes.md",
    });
  });

  await act(async () => {
    await result.current.actions.reloadDocument();
  });
  expect(result.current.state.selection.artifactIdentity).toEqual({
    kind: "directMarkdown",
    fileName: "Notes.md",
  });

  commands.loadSpecBundle.mockResolvedValue({
    ...bundle,
    artifacts: [bundle.artifacts[0]!],
  });
  await act(async () => {
    await result.current.actions.reloadDocument();
  });
  expect(result.current.state.selection.artifactIdentity).toEqual({
    kind: "standard",
    fileKey: "impl",
  });
  result.unmount();
});

test("zero artifact bundleはemptyでdocumentをidleにする", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockResolvedValue({
    specId: "spec-1",
    progress: "notStarted",
    artifacts: [],
  });
  const result = renderSpecs();
  await flushLoads();

  expect(result.current.state.bundleState.status).toBe("empty");
  expect(result.current.state.selection.artifactIdentity).toBeNull();
  expect(result.current.state.documentState.status).toBe("idle");
  result.unmount();
});
test("bundle command failureはzero artifactではなくbundle errorになる", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockRejectedValue({
    code: "bundleLoad",
    message: "Bundle unavailable.",
  });
  const result = renderSpecs();
  await flushLoads();

  expect(result.current.state.bundleState.status).toBe("error");
  expect(result.current.state.selection.artifactIdentity).toBeNull();
  result.unmount();
});

test("別spec選択はbundleを1回だけ読み、tree reloadで消えたspecを先頭へfallbackする", async () => {
  const secondSpec = {
    ...tree.specs[0]!,
    id: "spec-2",
    label: "Spec 2",
    relativeId: "spec-2",
  };
  const twoSpecTree: SpecTree = {
    specs: [...tree.specs, secondSpec],
  };
  commands.listSpecs.mockResolvedValue(twoSpecTree);
  commands.loadSpecBundle.mockImplementation(async ({ specId }) => ({
    ...bundle,
    specId,
  }));
  const result = renderSpecs();
  await flushLoads();

  await act(async () => {
    await result.current.actions.selectSpec("spec-2");
  });

  expect(commands.loadSpecBundle).toHaveBeenCalledTimes(2);
  expect(commands.loadSpecBundle).toHaveBeenLastCalledWith({
    workspacePath: "/workspace/spec-viewer",
    specId: "spec-2",
  });
  expect(result.current.state.selection.specId).toBe("spec-2");

  commands.listSpecs.mockResolvedValue(tree);
  await act(async () => {
    await result.current.actions.reloadSpecs();
  });

  expect(result.current.state.selection.specId).toBe("spec-1");
  expect(commands.loadSpecBundle).toHaveBeenLastCalledWith({
    workspacePath: "/workspace/spec-viewer",
    specId: "spec-1",
  });
  result.unmount();
});

test("all artifact read errorsはbundle全体をpartial errorとして保持する", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockResolvedValue({
    ...bundle,
    progress: "unknown",
    artifacts: bundle.artifacts.map((artifact) => ({
      ...artifact,
      contents: null,
      progress: "unknown" as const,
      error: { code: "markdownRead", message: "Unreadable." },
    })),
  });
  const result = renderSpecs();
  await flushLoads();

  expect(result.current.state.bundleState.status).toBe("partialError");
  expect(result.current.selectors.selectedArtifact?.error?.code).toBe(
    "markdownRead",
  );
  result.unmount();
});

test("同一specの遅い旧reload responseは新しいresponseを上書きしない", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockResolvedValue(bundle);
  const result = renderSpecs();
  await flushLoads();

  let resolveOlder: (value: SpecBundle) => void = () => undefined;
  let resolveNewer: (value: SpecBundle) => void = () => undefined;
  const older = new Promise<SpecBundle>((resolve) => {
    resolveOlder = resolve;
  });
  const newer = new Promise<SpecBundle>((resolve) => {
    resolveNewer = resolve;
  });
  commands.loadSpecBundle.mockReturnValueOnce(older).mockReturnValueOnce(newer);

  let olderReload = Promise.resolve(false);
  let newerReload = Promise.resolve(false);
  act(() => {
    olderReload = result.current.actions.reloadDocument();
    newerReload = result.current.actions.reloadDocument();
  });

  const newerBundle: SpecBundle = {
    ...bundle,
    artifacts: [
      {
        ...bundle.artifacts[0]!,
        contents: "# New response",
      },
    ],
  };
  await act(async () => {
    resolveNewer(newerBundle);
    await newerReload;
  });
  expect(result.current.selectors.selectedArtifact?.contents).toBe(
    "# New response",
  );

  const olderBundle: SpecBundle = {
    ...bundle,
    artifacts: [
      {
        ...bundle.artifacts[0]!,
        contents: "# Stale response",
      },
    ],
  };
  await act(async () => {
    resolveOlder(olderBundle);
    await olderReload;
  });
  expect(result.current.selectors.selectedArtifact?.contents).toBe(
    "# New response",
  );
  result.unmount();
});

test("stale tree responseは新しいtreeを上書きせずbundle IPCも開始しない", async () => {
  commands.listSpecs.mockResolvedValue(tree);
  commands.loadSpecBundle.mockResolvedValue(bundle);
  const result = renderSpecs();
  await flushLoads();

  let resolveOlder: (value: SpecTree) => void = () => undefined;
  let resolveNewer: (value: SpecTree) => void = () => undefined;
  const older = new Promise<SpecTree>((resolve) => {
    resolveOlder = resolve;
  });
  const newer = new Promise<SpecTree>((resolve) => {
    resolveNewer = resolve;
  });
  commands.listSpecs.mockReturnValueOnce(older).mockReturnValueOnce(newer);

  let olderReload = Promise.resolve(false);
  let newerReload = Promise.resolve(false);
  act(() => {
    olderReload = result.current.actions.reloadSpecs();
    newerReload = result.current.actions.reloadSpecs();
  });

  const newerTree: SpecTree = {
    specs: [{ ...tree.specs[0]!, label: "New tree" }],
  };
  await act(async () => {
    resolveNewer(newerTree);
    await newerReload;
  });
  expect(result.current.selectors.selectedSpec?.label).toBe("New tree");
  expect(commands.loadSpecBundle).toHaveBeenCalledTimes(2);

  const olderTree: SpecTree = {
    specs: [{ ...tree.specs[0]!, label: "Stale tree" }],
  };
  await act(async () => {
    resolveOlder(olderTree);
    await olderReload;
  });
  expect(result.current.selectors.selectedSpec?.label).toBe("New tree");
  expect(commands.loadSpecBundle).toHaveBeenCalledTimes(2);
  result.unmount();
});
