import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  SpecViewSelectionProvider,
  useSpecViewSelection,
  type SpecViewSelectionContextValue,
} from "@/app/context/specViewSelection";
import type { SpecFileKey } from "@/features/specs/types/spec";
import { WorkspacePath } from "@/shared/domain/workspacePath";

function createContainerRoot(): Readonly<{
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);

  return { container, root };
}

test("SpecViewSelectionProviderはselection propなしで選択状態とselectionIdを保持する", () => {
  const values: SpecViewSelectionContextValue[] = [];
  const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
  const { container, root } = createContainerRoot();
  let currentValue: SpecViewSelectionContextValue | null = null;

  function Probe(): null {
    currentValue = useSpecViewSelection();
    values.push(currentValue);
    return null;
  }

  act(() => {
    root.render(
      <SpecViewSelectionProvider>
        <Probe />
      </SpecViewSelectionProvider>,
    );
  });
  act(() => {
    currentValue?.setWorkspaceSelection({
      workspacePath,
      specId: "auth",
      fileKey: "tasks" as SpecFileKey,
    });
  });
  act(() => {
    root.render(
      <SpecViewSelectionProvider>
        <Probe />
      </SpecViewSelectionProvider>,
    );
  });

  expect(values[0]?.selectionId).toBe("none:none");
  expect(values[values.length - 1]?.selection).toMatchObject({
    workspacePath,
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
  });
  expect(values[values.length - 1]?.selectionId).toBe(
    "/workspace/spec-reviewer:file:auth:tasks",
  );
  expect(values[values.length - 1]).toBe(values[values.length - 2]);
  root.unmount();
  container.remove();
});

test.each([
  {
    name: "workspace変更",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/other"),
      specId: "auth",
      fileKey: "tasks" as SpecFileKey,
    },
    targetScope: "file" as const,
    expected: "/workspace/other:file:auth:tasks",
  },
  {
    name: "spec変更",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "billing",
      fileKey: "tasks" as SpecFileKey,
    },
    targetScope: "file" as const,
    expected: "/workspace/spec-reviewer:file:billing:tasks",
  },
  {
    name: "file変更",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: "implementation" as SpecFileKey,
    },
    targetScope: "file" as const,
    expected: "/workspace/spec-reviewer:file:auth:implementation",
  },
  {
    name: "spec scope変更",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: "tasks" as SpecFileKey,
    },
    targetScope: "spec" as const,
    expected: "/workspace/spec-reviewer:spec:auth",
  },
  {
    name: "fileKey未確定",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: null,
    },
    targetScope: "file" as const,
    expected: "/workspace/spec-reviewer:none",
  },
])("SpecViewSelectionProviderは内部selectionの$nameでselectionIdを更新する", ({
  workspaceSelection,
  targetScope,
  expected,
}) => {
  const values: SpecViewSelectionContextValue[] = [];
  const { container, root } = createContainerRoot();
  let currentValue: SpecViewSelectionContextValue | null = null;

  function Probe(): null {
    currentValue = useSpecViewSelection();
    values.push(currentValue);
    return null;
  }

  act(() => {
    root.render(
      <SpecViewSelectionProvider>
        <Probe />
      </SpecViewSelectionProvider>,
    );
  });
  act(() => {
    currentValue?.setWorkspaceSelection(workspaceSelection);
  });
  act(() => {
    currentValue?.setTargetScope(targetScope);
  });

  expect(values[values.length - 1]?.selectionId).toBe(expected);
  root.unmount();
  container.remove();
});
