import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  SpecViewIdentityProvider,
  useSpecViewIdentity,
  type SpecViewIdentityContextValue,
} from "@/app/context/specViewIdentity";
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

test("SpecViewIdentityProviderはselection propなしで選択状態とidentityを保持する", () => {
  const values: SpecViewIdentityContextValue[] = [];
  const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
  const { container, root } = createContainerRoot();
  let currentValue: SpecViewIdentityContextValue | null = null;

  function Probe(): null {
    currentValue = useSpecViewIdentity();
    values.push(currentValue);
    return null;
  }

  act(() => {
    root.render(
      <SpecViewIdentityProvider>
        <Probe />
      </SpecViewIdentityProvider>,
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
      <SpecViewIdentityProvider>
        <Probe />
      </SpecViewIdentityProvider>,
    );
  });

  expect(values[0]?.viewIdentity).toBe("none:none");
  expect(values[values.length - 1]?.selection).toMatchObject({
    workspacePath,
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
  });
  expect(values[values.length - 1]?.viewIdentity).toBe(
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
])("SpecViewIdentityProviderは内部selectionの$nameでidentityを更新する", ({
  workspaceSelection,
  targetScope,
  expected,
}) => {
  const values: SpecViewIdentityContextValue[] = [];
  const { container, root } = createContainerRoot();
  let currentValue: SpecViewIdentityContextValue | null = null;

  function Probe(): null {
    currentValue = useSpecViewIdentity();
    values.push(currentValue);
    return null;
  }

  act(() => {
    root.render(
      <SpecViewIdentityProvider>
        <Probe />
      </SpecViewIdentityProvider>,
    );
  });
  act(() => {
    currentValue?.setWorkspaceSelection(workspaceSelection);
  });
  act(() => {
    currentValue?.setTargetScope(targetScope);
  });

  expect(values[values.length - 1]?.viewIdentity).toBe(expected);
  root.unmount();
  container.remove();
});
