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

test("SpecViewIdentityProviderは同一selectionの再描画でcontext valueを維持する", () => {
  const values: SpecViewIdentityContextValue[] = [];
  const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
  const firstSelection = {
    workspacePath,
    specId: "auth",
    fileKey: "tasks" as SpecFileKey,
    targetScope: "file" as const,
  };
  const secondSelection = { ...firstSelection };
  const { container, root } = createContainerRoot();

  function Probe(): null {
    values.push(useSpecViewIdentity());
    return null;
  }

  act(() => {
    root.render(
      <SpecViewIdentityProvider selection={firstSelection}>
        <Probe />
      </SpecViewIdentityProvider>,
    );
  });
  act(() => {
    root.render(
      <SpecViewIdentityProvider selection={secondSelection}>
        <Probe />
      </SpecViewIdentityProvider>,
    );
  });

  expect(values[0]?.viewIdentity).toBe(
    "/workspace/spec-reviewer:file:auth:tasks",
  );
  expect(values[1]).toBe(values[0]);
  root.unmount();
  container.remove();
});

test.each([
  {
    name: "workspace変更",
    selection: {
      workspacePath: WorkspacePath.fromString("/workspace/other"),
      specId: "auth",
      fileKey: "tasks" as SpecFileKey,
      targetScope: "file" as const,
    },
    expected: "/workspace/other:file:auth:tasks",
  },
  {
    name: "spec変更",
    selection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "billing",
      fileKey: "tasks" as SpecFileKey,
      targetScope: "file" as const,
    },
    expected: "/workspace/spec-reviewer:file:billing:tasks",
  },
  {
    name: "file変更",
    selection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: "implementation" as SpecFileKey,
      targetScope: "file" as const,
    },
    expected: "/workspace/spec-reviewer:file:auth:implementation",
  },
  {
    name: "spec scope変更",
    selection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: "tasks" as SpecFileKey,
      targetScope: "spec" as const,
    },
    expected: "/workspace/spec-reviewer:spec:auth",
  },
  {
    name: "fileKey未確定",
    selection: {
      workspacePath: WorkspacePath.fromString("/workspace/spec-reviewer"),
      specId: "auth",
      fileKey: null,
      targetScope: "file" as const,
    },
    expected: "/workspace/spec-reviewer:none",
  },
])("SpecViewIdentityProviderは$nameでidentityを更新する", ({
  selection,
  expected,
}) => {
  const values: SpecViewIdentityContextValue[] = [];
  const { container, root } = createContainerRoot();

  function Probe(): null {
    values.push(useSpecViewIdentity());
    return null;
  }

  act(() => {
    root.render(
      <SpecViewIdentityProvider selection={selection}>
        <Probe />
      </SpecViewIdentityProvider>,
    );
  });

  expect(values[0]?.viewIdentity).toBe(expected);
  root.unmount();
  container.remove();
});
