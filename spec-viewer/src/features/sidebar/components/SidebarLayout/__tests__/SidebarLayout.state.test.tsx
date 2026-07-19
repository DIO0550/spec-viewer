import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";

import {
  SidebarLayout,
  SidebarPreferenceProvider,
} from "@/features/sidebar";
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
      <SidebarLayout leftNavigation={{ isOpen: true }}>
        <WorkspaceLayout.LeftNavigation>Left</WorkspaceLayout.LeftNavigation>
        <WorkspaceLayout.Main>
          <WorkspaceLayout.Toolbar>Toolbar</WorkspaceLayout.Toolbar>
          <WorkspaceLayout.Tabs>Tabs</WorkspaceLayout.Tabs>
          <WorkspaceLayout.Viewer>Viewer</WorkspaceLayout.Viewer>
        </WorkspaceLayout.Main>
        <WorkspaceLayout.Comments>Comments</WorkspaceLayout.Comments>
      </SidebarLayout>
    </SidebarPreferenceProvider>,
  );
}

test("SidebarLayoutはContextの閉じた状態をright panel controlへ注入する", () => {
  window.localStorage.setItem("spec-reviewer.comment-sidebar-open", "false");
  const result = renderSidebarLayout();
  const body = result.container.querySelector(".app-shell__body");
  const commentsSidebar = result.container.querySelector(
    '[aria-label="コメントサイドバー"]',
  );
  const reopenButton = result.container.querySelector(
    '[aria-label="サイドバーを開く"]',
  ) as HTMLButtonElement;

  expect(body?.getAttribute("data-comments-sidebar")).toBe("collapsed");
  expect(commentsSidebar?.getAttribute("aria-hidden")).toBe("true");

  act(() => {
    reopenButton.click();
  });

  expect(body?.getAttribute("data-comments-sidebar")).toBe("open");
  expect(window.localStorage.getItem("spec-reviewer.comment-sidebar-open")).toBe(
    "true",
  );
  result.unmount();
});

test("SidebarLayoutは保存済み幅をright panel controlへ注入する", () => {
  window.innerWidth = 1440;
  window.localStorage.setItem("spec-reviewer.comment-sidebar-width", "420");
  const result = renderSidebarLayout();
  const body = result.container.querySelector(".app-shell__body") as HTMLElement;
  const resizeHandle = result.container.querySelector(
    '[aria-label="サイドバー幅を変更"]',
  );

  expect(body.style.getPropertyValue("--comment-sidebar-width")).toBe("420px");
  expect(resizeHandle?.getAttribute("aria-valuenow")).toBe("420");
  result.unmount();
});
