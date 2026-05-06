import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import type { SpecDocumentState, SpecTreeState } from "../hooks/useSpecs";
import type {
  SpecDocument,
  SpecFile,
  SpecNode,
  SpecTree as SpecTreeShape,
} from "../types/spec";
import { AppShell } from "./AppShell";
import { MarkdownViewer } from "./MarkdownViewer";
import { SpecTabs } from "./SpecTabs";
import { SpecTree } from "./SpecTree";
import { WorkspaceToolbar } from "./WorkspaceToolbar";

const workspacePath = "/workspace/spec-reviewer";

const taskFile: SpecFile = {
  key: "tasks",
  label: "Tasks",
  fileName: "tasks.md",
  status: "present",
};

const implFile: SpecFile = {
  key: "impl",
  label: "Implementation",
  fileName: "implementation-plan.md",
  status: "missing",
};

const selectedSpec: SpecNode = {
  id: "phase-1-viewer",
  label: "Phase 1 Viewer",
  files: [taskFile, implFile],
  children: [
    {
      id: "phase-1-comments",
      label: "Phase 1 Comments",
      files: [taskFile],
      children: [],
    },
  ],
};

const readyTree: SpecTreeShape = {
  specs: [selectedSpec],
};

const readyTreeState: SpecTreeState = {
  status: "ready",
  workspacePath,
  tree: readyTree,
  error: null,
};

const readyDocument: SpecDocument = {
  key: "tasks",
  path: "/workspace/spec-reviewer/docs/plans/tasks.md",
  contents: "# Phase 1 Viewer\n\n- Layout components",
  missing: false,
  blocks: [],
};

const readyDocumentState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: selectedSpec.id,
  fileKey: "tasks",
  document: readyDocument,
  error: null,
};

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

test("AppShellはtoolbar、tree、tabs、viewer、comment sidebarを表示する", () => {
  const result = renderComponent(
    <AppShell
      toolbar={
        <WorkspaceToolbar
          workspacePath={workspacePath}
          inputValue={workspacePath}
          isLoading={false}
          isBrowsing={false}
          errorMessage={null}
          refreshStatus={{ status: "idle", message: null }}
          canRefresh={true}
          themeMode="system"
          onInputChange={vi.fn()}
          onBrowse={vi.fn()}
          onLoad={vi.fn()}
          onRefresh={vi.fn()}
          onReset={vi.fn()}
          onThemeModeChange={vi.fn()}
        />
      }
      sidebar={
        <SpecTree
          state={readyTreeState}
          selectedSpecId={selectedSpec.id}
          onSelectSpec={vi.fn()}
          onReload={vi.fn()}
        />
      }
      tabs={
        <SpecTabs
          spec={selectedSpec}
          selectedFileKey="tasks"
          onSelectFile={vi.fn()}
        />
      }
      viewer={
        <MarkdownViewer
          state={readyDocumentState}
          selectedSpecLabel={selectedSpec.label}
          selectedFileLabel={taskFile.label}
          onReload={vi.fn()}
        />
      }
      comments={<div>Comments</div>}
    />,
  );

  expect(
    result.container.querySelector('[aria-label="ワークスペース操作"]'),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="Specツリー"]'),
  ).not.toBeNull();
  expect(result.container.querySelector('[role="tablist"]')).not.toBeNull();
  expect(
    result.container.querySelector("#markdown-viewer-panel"),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="コメントサイドバー"]'),
  ).not.toBeNull();
  result.unmount();
});

test("AppShellはコメントサイドバーを閉じると再オープン導線を表示する", () => {
  const onOpenCommentsSidebar = vi.fn();
  const result = renderComponent(
    <AppShell
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      isCommentsSidebarOpen={false}
      onOpenCommentsSidebar={onOpenCommentsSidebar}
    />,
  );
  const body = result.container.querySelector(".app-shell__body");
  const commentsSidebar = result.container.querySelector(
    '[aria-label="コメントサイドバー"]',
  );
  const reopenButton = result.container.querySelector(
    '[aria-label="サイドバーを開く"]',
  ) as HTMLButtonElement;

  act(() => {
    reopenButton.click();
  });

  expect(body?.getAttribute("data-comments-sidebar")).toBe("collapsed");
  expect(commentsSidebar?.getAttribute("aria-hidden")).toBe("true");
  expect(onOpenCommentsSidebar).toHaveBeenCalledOnce();
  result.unmount();
});

test("AppShellはEscapeで開いているコメントサイドバーを閉じる", () => {
  const onCloseCommentsSidebar = vi.fn();
  const result = renderComponent(
    <AppShell
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<button type="button">コメント操作</button>}
      isCommentsSidebarOpen={true}
      onCloseCommentsSidebar={onCloseCommentsSidebar}
    />,
  );
  const body = result.container.querySelector(
    ".app-shell__body",
  ) as HTMLElement;

  act(() => {
    body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCloseCommentsSidebar).toHaveBeenCalledOnce();
  result.unmount();
});

test("AppShellはドラッグでコメントサイドバー幅を変更する", () => {
  const onCommentsSidebarWidthChange = vi.fn();
  const result = renderComponent(
    <AppShell
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      commentsSidebarWidth={360}
      commentsSidebarMinWidth={280}
      commentsSidebarMaxWidth={560}
      onCommentsSidebarWidthChange={onCommentsSidebarWidthChange}
    />,
  );
  const body = result.container.querySelector(
    ".app-shell__body",
  ) as HTMLElement;
  const resizeHandle = result.container.querySelector(
    '[aria-label="サイドバー幅を変更"]',
  ) as HTMLButtonElement;

  body.getBoundingClientRect = () =>
    ({
      right: 1000,
    }) as DOMRect;

  act(() => {
    resizeHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 620,
        pointerId: 1,
      }),
    );
  });

  expect(onCommentsSidebarWidthChange).toHaveBeenCalledWith(380);
  result.unmount();
});

test("AppShellはキーボードでコメントサイドバー幅を変更する", () => {
  const onCommentsSidebarWidthChange = vi.fn();
  const result = renderComponent(
    <AppShell
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      commentsSidebarWidth={360}
      commentsSidebarMinWidth={280}
      commentsSidebarMaxWidth={560}
      onCommentsSidebarWidthChange={onCommentsSidebarWidthChange}
    />,
  );
  const resizeHandle = result.container.querySelector(
    '[aria-label="サイドバー幅を変更"]',
  ) as HTMLButtonElement;

  act(() => {
    resizeHandle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  });

  expect(onCommentsSidebarWidthChange).toHaveBeenCalledWith(376);
  result.unmount();
});

test("SpecTreeはspec選択イベントを発火する", () => {
  const onSelectSpec = vi.fn();
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId={null}
      onSelectSpec={onSelectSpec}
      onReload={vi.fn()}
    />,
  );
  const button = result.container.querySelector(
    ".spec-tree__item",
  ) as HTMLButtonElement;

  act(() => {
    button.click();
  });

  expect(onSelectSpec).toHaveBeenCalledWith("phase-1-viewer");
  result.unmount();
});

test("SpecTreeは読み込み中にskeleton statusを表示する", () => {
  const result = renderComponent(
    <SpecTree
      state={{
        status: "loading",
        workspacePath,
        tree: null,
        error: null,
      }}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "Specファイルをスキャン中",
  );
  expect(
    result.container.querySelectorAll(".loading-skeleton__bar").length,
  ).toBeGreaterThan(0);
  result.unmount();
});

test("SpecTreeは矢印キーでtree itemのfocusを移動する", () => {
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  const buttons = result.container.querySelectorAll(".spec-tree__item");

  act(() => {
    (buttons[0] as HTMLButtonElement).focus();
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });

  expect(document.activeElement).toBe(buttons[1]);
  result.unmount();
});

test("SpecTreeは左右矢印キーで親子tree itemへfocusを移動する", () => {
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  const buttons = result.container.querySelectorAll(".spec-tree__item");

  act(() => {
    (buttons[0] as HTMLButtonElement).focus();
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });

  expect(document.activeElement).toBe(buttons[1]);

  act(() => {
    buttons[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  });

  expect(document.activeElement).toBe(buttons[0]);
  result.unmount();
});

test("SpecTabsは選択中tabとfile選択イベントを表現する", () => {
  const onSelectFile = vi.fn();
  const result = renderComponent(
    <SpecTabs
      spec={selectedSpec}
      selectedFileKey="tasks"
      onSelectFile={onSelectFile}
    />,
  );
  const tabs = result.container.querySelectorAll('[role="tab"]');

  expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
  expect(tabs[1]?.textContent).toContain("missing");

  act(() => {
    (tabs[1] as HTMLButtonElement).click();
  });

  expect(onSelectFile).toHaveBeenCalledWith("impl");
  result.unmount();
});

test("SpecTabsは矢印キーで隣のtabを選択する", () => {
  const onSelectFile = vi.fn();
  const result = renderComponent(
    <SpecTabs
      spec={selectedSpec}
      selectedFileKey="tasks"
      onSelectFile={onSelectFile}
    />,
  );
  const tabs = result.container.querySelectorAll('[role="tab"]');

  act(() => {
    (tabs[0] as HTMLButtonElement).focus();
    tabs[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });

  expect(onSelectFile).toHaveBeenCalledWith("impl");
  result.unmount();
});

test("WorkspaceToolbarはopen workspace操作を発火する", () => {
  const onBrowse = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={null}
      inputValue=""
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={false}
      themeMode="system"
      onInputChange={vi.fn()}
      onBrowse={onBrowse}
      onLoad={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
      onThemeModeChange={vi.fn()}
    />,
  );
  const openButton = result.container.querySelector(
    '[aria-label="ワークスペースフォルダを開く"]',
  ) as HTMLButtonElement;

  act(() => {
    openButton.click();
  });

  expect(onBrowse).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceToolbarはcurrent view refresh操作と状態を表示する", () => {
  const onRefresh = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={workspacePath}
      inputValue={workspacePath}
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{
        status: "stale",
        message: "Content may be stale. Refresh to retry.",
      }}
      canRefresh={true}
      themeMode="system"
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={onRefresh}
      onReset={vi.fn()}
      onThemeModeChange={vi.fn()}
    />,
  );
  const refreshButton = result.container.querySelector(
    '[aria-label="現在の表示を再読み込み"]',
  ) as HTMLButtonElement;

  expect(result.container.textContent).toContain("Content may be stale");

  act(() => {
    refreshButton.click();
  });

  expect(onRefresh).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceToolbarはtheme mode変更を発火する", () => {
  const onThemeModeChange = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={workspacePath}
      inputValue={workspacePath}
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={true}
      themeMode="system"
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
      onThemeModeChange={onThemeModeChange}
    />,
  );
  const themeSelect = result.container.querySelector(
    "#theme-mode",
  ) as HTMLSelectElement;

  act(() => {
    themeSelect.value = "dark";
    themeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(onThemeModeChange).toHaveBeenCalledWith("dark");
  result.unmount();
});

test("WorkspaceToolbarはrecent workspace操作を発火する", () => {
  const onOpenRecentWorkspace = vi.fn();
  const onRemoveRecentWorkspace = vi.fn();
  const onClearRecentWorkspaces = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={null}
      inputValue=""
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={false}
      themeMode="system"
      recentWorkspaces={[
        {
          path: "/workspace/recent",
          openedAt: "2026-05-05T00:00:00.000Z",
        },
      ]}
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
      onThemeModeChange={vi.fn()}
      onOpenRecentWorkspace={onOpenRecentWorkspace}
      onRemoveRecentWorkspace={onRemoveRecentWorkspace}
      onClearRecentWorkspaces={onClearRecentWorkspaces}
    />,
  );
  const recentItem = result.container.querySelector(
    ".workspace-toolbar__recent-item",
  ) as HTMLButtonElement;
  const removeButton = result.container.querySelector(
    '[aria-label="/workspace/recentを最近使ったワークスペースから削除"]',
  ) as HTMLButtonElement;
  const clearButton = result.container.querySelector(
    ".workspace-toolbar__recent-clear",
  ) as HTMLButtonElement;

  act(() => {
    recentItem.click();
    removeButton.click();
    clearButton.click();
  });

  expect(onOpenRecentWorkspace).toHaveBeenCalledWith("/workspace/recent");
  expect(onRemoveRecentWorkspace).toHaveBeenCalledWith("/workspace/recent");
  expect(onClearRecentWorkspaces).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceToolbarはEscapeでrecent workspaces menuを閉じる", () => {
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={null}
      inputValue=""
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={false}
      themeMode="system"
      recentWorkspaces={[
        {
          path: "/workspace/recent",
          openedAt: "2026-05-05T00:00:00.000Z",
        },
      ]}
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
      onThemeModeChange={vi.fn()}
    />,
  );
  const details = result.container.querySelector(
    ".workspace-toolbar__recent",
  ) as HTMLDetailsElement;
  const summary = result.container.querySelector("summary") as HTMLElement;

  act(() => {
    summary.click();
  });

  expect(details.open).toBe(true);

  act(() => {
    details.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  result.unmount();
});

test("MarkdownViewerは読み込み中状態をrole statusで表示する", () => {
  const loadingState: SpecDocumentState = {
    status: "loading",
    workspacePath,
    specId: selectedSpec.id,
    fileKey: "tasks",
    document: null,
    error: null,
  };
  const result = renderComponent(
    <MarkdownViewer
      state={loadingState}
      selectedSpecLabel={selectedSpec.label}
      selectedFileLabel={taskFile.label}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector('[role="status"]')?.textContent,
  ).toContain("Markdownを読み込み中");
  result.unmount();
});

test("MarkdownViewerはMarkdownをHTMLとして表示する", () => {
  const result = renderComponent(
    <MarkdownViewer
      state={readyDocumentState}
      selectedSpecLabel={selectedSpec.label}
      selectedFileLabel={taskFile.label}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector(
      '[aria-label="レンダリング済みMarkdownドキュメント"]',
    )?.textContent,
  ).toContain("Layout components");
  result.unmount();
});
