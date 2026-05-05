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
          onInputChange={vi.fn()}
          onBrowse={vi.fn()}
          onLoad={vi.fn()}
          onRefresh={vi.fn()}
          onReset={vi.fn()}
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
    result.container.querySelector('[aria-label="Workspace controls"]'),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="Spec tree"]'),
  ).not.toBeNull();
  expect(result.container.querySelector('[role="tablist"]')).not.toBeNull();
  expect(
    result.container.querySelector("#markdown-viewer-panel"),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="Comment sidebar"]'),
  ).not.toBeNull();
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
      onInputChange={vi.fn()}
      onBrowse={onBrowse}
      onLoad={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
    />,
  );
  const openButton = result.container.querySelector(
    '[aria-label="Open workspace folder"]',
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
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={onRefresh}
      onReset={vi.fn()}
    />,
  );
  const refreshButton = result.container.querySelector(
    '[aria-label="Refresh current view"]',
  ) as HTMLButtonElement;

  expect(result.container.textContent).toContain("Content may be stale");

  act(() => {
    refreshButton.click();
  });

  expect(onRefresh).toHaveBeenCalledOnce();
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
  ).toContain("Loading Markdown");
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
    result.container.querySelector('[aria-label="Rendered Markdown document"]')
      ?.textContent,
  ).toContain("Layout components");
  result.unmount();
});
