import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  WorkspaceProvider,
  useWorkspace,
  type WorkspaceContextValue,
} from "@/features/workspace/context";

test("WorkspaceProviderはworkspace contextを提供する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const seenValues: WorkspaceContextValue[] = [];

  function Consumer(): null {
    seenValues.push(useWorkspace());
    return null;
  }

  act(() => {
    root.render(
      <WorkspaceProvider>
        <Consumer />
      </WorkspaceProvider>,
    );
  });

  expect(seenValues[0]?.state.status).toBe("idle");
  expect(seenValues[0]?.workspacePath).toBeNull();
  expect(seenValues[0]?.workspace).toBeNull();

  act(() => {
    root.unmount();
  });
});

test("useWorkspaceはProvider外で明確なerrorを投げる", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  function Consumer(): null {
    useWorkspace();
    return null;
  }

  expect(() => {
    act(() => {
      root.render(<Consumer />);
    });
  }).toThrow("WorkspaceProvider is missing");

  act(() => {
    root.unmount();
  });
});
