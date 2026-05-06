import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { WorkspaceSidebarSection } from "./WorkspaceSidebarSection";

type RenderResult = Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}>;

function renderComponent(component: ReactNode): RenderResult {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(component);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

test("WorkspaceSidebarSectionは現在のworkspaceと保存済みworkspaceを左ナビに表示する", () => {
  const result = renderComponent(
    <WorkspaceSidebarSection
      currentWorkspacePath="/workspace"
      isBusy={false}
      recentWorkspaces={[
        {
          path: "/workspace",
          displayName: "workspace",
          kind: "plugin-workspace",
          lastOpenedAt: "2026-05-06T00:00:00.000Z",
        },
        {
          path: "/workspace/spec-reviewer",
          displayName: "spec-reviewer",
          kind: "plugin-workspace",
          lastOpenedAt: "2026-05-05T00:00:00.000Z",
        },
      ]}
      onBrowse={vi.fn()}
      onOpenWorkspace={vi.fn()}
      onRemoveWorkspace={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector('[aria-label="ワークスペース一覧"]'),
  ).not.toBeNull();
  expect(result.container.textContent).toContain("現在のワークスペース");
  expect(result.container.textContent).toContain("/workspace");
  expect(result.container.textContent).toContain("spec-reviewer");
  result.unmount();
});

test("WorkspaceSidebarSectionは保存済みworkspace操作を発火する", () => {
  const onBrowse = vi.fn();
  const onOpenWorkspace = vi.fn();
  const onRemoveWorkspace = vi.fn();
  const result = renderComponent(
    <WorkspaceSidebarSection
      currentWorkspacePath="/workspace"
      isBusy={false}
      recentWorkspaces={[
        {
          path: "/workspace/spec-reviewer",
          displayName: "spec-reviewer",
          kind: "plugin-workspace",
          lastOpenedAt: "2026-05-05T00:00:00.000Z",
        },
      ]}
      onBrowse={onBrowse}
      onOpenWorkspace={onOpenWorkspace}
      onRemoveWorkspace={onRemoveWorkspace}
    />,
  );
  const browseButton = result.container.querySelector(
    '[aria-label="ワークスペースフォルダを開く"]',
  ) as HTMLButtonElement;
  const openButton = result.container.querySelector(
    '[aria-label="spec-reviewerを開く"]',
  ) as HTMLButtonElement;
  const removeButton = result.container.querySelector(
    '[aria-label="/workspace/spec-reviewerを一覧から削除"]',
  ) as HTMLButtonElement;

  act(() => {
    browseButton.click();
    openButton.click();
    removeButton.click();
  });

  expect(onBrowse).toHaveBeenCalledOnce();
  expect(onOpenWorkspace).toHaveBeenCalledWith("/workspace/spec-reviewer");
  expect(onRemoveWorkspace).toHaveBeenCalledWith("/workspace/spec-reviewer");
  result.unmount();
});
