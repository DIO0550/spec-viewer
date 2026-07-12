import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  type SpecViewSelectionContextValue,
  SpecViewSelectionProvider,
  useSpecViewSelection,
} from "@/app/context/specViewSelection";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import {
  SelectionIdentity,
  SpecViewSelection,
} from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

function createContainerRoot(): Readonly<{
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);

  return { container, root };
}

test("SpecViewSelectionProviderはaggregate stateとderived identityだけを保持する", () => {
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
    currentValue?.synchronizeSelection({
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

  expect(values[0]?.selectionIdentity).toBe(
    SelectionIdentity.fromSelection(SpecViewSelection.empty()),
  );
  expect(values[values.length - 1]?.selection).toMatchObject({
    workspacePath,
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
  });
  expect(values[values.length - 1]?.selectionIdentity).toBe(
    SelectionIdentity.fromSelection(
      SpecViewSelection.synchronize(SpecViewSelection.empty(), {
        workspacePath,
        specId: "auth",
        fileKey: "tasks",
      }),
    ),
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
  },
  {
    name: "spec変更",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "billing",
      fileKey: "tasks" as SpecFileKey,
    },
    targetScope: "file" as const,
  },
  {
    name: "file変更",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: "implementation" as SpecFileKey,
    },
    targetScope: "file" as const,
  },
  {
    name: "spec scope変更",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: "tasks" as SpecFileKey,
    },
    targetScope: "spec" as const,
  },
  {
    name: "fileKey未確定",
    workspaceSelection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: null,
    },
    targetScope: "file" as const,
  },
])("SpecViewSelectionProviderは内部aggregateの$nameでidentityを更新する", ({
  workspaceSelection,
  targetScope,
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
    currentValue?.synchronizeSelection(workspaceSelection);
  });
  act(() => {
    currentValue?.selectTargetScope(targetScope);
  });

  const expectedSelection = SpecViewSelection.selectTargetScope(
    SpecViewSelection.synchronize(
      SpecViewSelection.empty(),
      workspaceSelection,
    ),
    targetScope,
  );
  expect(values[values.length - 1]?.selectionIdentity).toBe(
    SelectionIdentity.fromSelection(expectedSelection),
  );
  root.unmount();
  container.remove();
});
