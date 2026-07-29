import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";

import { SidebarLayout, SidebarPreferenceProvider } from "@/features/sidebar";
import { WorkspaceLayout } from "@/components";

type RenderResult = Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}>;

afterEach(() => {
  window.localStorage.clear();
});

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

function renderSidebarLayout(): RenderResult {
  return renderComponent(
    <SidebarPreferenceProvider>
      <SidebarLayout worktrees={{ isOpen: true }}>
        <WorkspaceLayout.Toolbar>Toolbar</WorkspaceLayout.Toolbar>
        <WorkspaceLayout.Worktrees>Left</WorkspaceLayout.Worktrees>
        <WorkspaceLayout.ModeNavigation>Tabs</WorkspaceLayout.ModeNavigation>
        <WorkspaceLayout.Content>Viewer</WorkspaceLayout.Content>
        <WorkspaceLayout.Comments>Comments</WorkspaceLayout.Comments>
      </SidebarLayout>
    </SidebarPreferenceProvider>,
  );
}

test("SidebarLayoutはContextの閉じた状態をright panel controlへ注入する", () => {
  window.localStorage.setItem("spec-reviewer.comment-sidebar-open", "false");
  const result = renderSidebarLayout();
  const body = result.container.querySelector(".app-shell__body");
  const comments = result.container.querySelector(
    '[aria-label="コメントサイドバー"]',
  );
  const reopenButton = result.container.querySelector(
    '[aria-label="サイドバーを開く"]',
  ) as HTMLButtonElement;

  expect(body?.getAttribute("data-comments")).toBe("collapsed");
  expect(comments?.getAttribute("aria-hidden")).toBe("true");

  act(() => {
    reopenButton.click();
  });

  expect(body?.getAttribute("data-comments")).toBe("open");
  expect(
    window.localStorage.getItem("spec-reviewer.comment-sidebar-open"),
  ).toBe("true");
  result.unmount();
});

test("SidebarLayoutは保存済み幅をright panel controlへ注入する", () => {
  window.innerWidth = 1440;
  window.localStorage.setItem("spec-reviewer.comment-sidebar-width", "420");
  const result = renderSidebarLayout();
  const body = result.container.querySelector(
    ".app-shell__body",
  ) as HTMLElement;
  const resizeHandle = result.container.querySelector(
    '[aria-label="サイドバー幅を変更"]',
  );

  expect(body.style.getPropertyValue("--comments-width")).toBe("420px");
  expect(resizeHandle?.getAttribute("aria-valuenow")).toBe("420");
  result.unmount();
});
