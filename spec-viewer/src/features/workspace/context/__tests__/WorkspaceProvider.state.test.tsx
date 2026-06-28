import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  WorkspaceProvider,
  selectActiveWorkspaceRoot,
  selectWorkspace,
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
  expect(
    selectActiveWorkspaceRoot(seenValues[0]?.state ?? { status: "idle" }),
  ).toBeNull();
  expect(
    selectWorkspace(seenValues[0]?.state ?? { status: "idle" }),
  ).toBeNull();
  expect(typeof seenValues[0]?.actions.load).toBe("function");
  expect(typeof seenValues[0]?.actions.reset).toBe("function");

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
