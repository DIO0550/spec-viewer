import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { WorkspaceLayout } from "@/components/WorkspaceLayout";

test("WorkspaceLayoutは5 slotと3つのresize separatorを描画する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(
      <WorkspaceLayout.Root
        worktrees={{ width: 240, onWidthChange: vi.fn() }}
        modeNavigation={{ width: 220, onWidthChange: vi.fn() }}
        comments={{ width: 300, onWidthChange: vi.fn() }}
      >
        <WorkspaceLayout.Worktrees>Worktrees</WorkspaceLayout.Worktrees>
        <WorkspaceLayout.Toolbar>
          <div>Workspace toolbar</div>
          <div>View mode toolbar</div>
        </WorkspaceLayout.Toolbar>
        <WorkspaceLayout.ModeNavigation>Specs</WorkspaceLayout.ModeNavigation>
        <WorkspaceLayout.Content>Content</WorkspaceLayout.Content>
        <WorkspaceLayout.Comments>Comments</WorkspaceLayout.Comments>
      </WorkspaceLayout.Root>,
    );
  });

  const body = container.querySelector<HTMLElement>(".app-shell__body");
  expect(body?.style.getPropertyValue("--worktrees-width")).toBe("240px");
  expect(body?.style.getPropertyValue("--mode-navigation-width")).toBe("220px");
  expect(body?.style.getPropertyValue("--comments-width")).toBe("300px");
  expect(container.querySelectorAll('[role="separator"]')).toHaveLength(3);
  expect(container.querySelector(".app-shell__worktrees")).not.toBeNull();
  expect(container.querySelector(".app-shell__mode-navigation")).not.toBeNull();
  expect(container.querySelector(".app-shell__content")).not.toBeNull();
  expect(container.querySelector(".app-shell__comments")).not.toBeNull();

  act(() => {
    root.unmount();
  });
});

test("ModeNavigation separatorはArrowとHome/Endでcontrolled幅を通知する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const onWidthChange = vi.fn();

  act(() => {
    root.render(
      <WorkspaceLayout.Root
        modeNavigation={{
          width: 220,
          minWidth: 216,
          maxWidth: 420,
          onWidthChange,
        }}
      >
        <WorkspaceLayout.Worktrees>Worktrees</WorkspaceLayout.Worktrees>
        <WorkspaceLayout.Toolbar>Toolbar</WorkspaceLayout.Toolbar>
        <WorkspaceLayout.ModeNavigation>
          Navigation
        </WorkspaceLayout.ModeNavigation>
        <WorkspaceLayout.Content>Content</WorkspaceLayout.Content>
        <WorkspaceLayout.Comments>Comments</WorkspaceLayout.Comments>
      </WorkspaceLayout.Root>,
    );
  });

  const separator = container.querySelector<HTMLButtonElement>(
    '[aria-label="Mode navigation の幅を変更"]',
  );

  for (const key of ["ArrowRight", "Home", "End"]) {
    act(() => {
      separator?.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    });
  }

  expect(onWidthChange.mock.calls).toEqual([[236], [216], [420]]);
  act(() => {
    root.unmount();
  });
});
