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
          errorMessage={null}
          onInputChange={vi.fn()}
          onLoad={vi.fn()}
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

test("MarkdownViewerはMarkdown source previewを表示する", () => {
  const result = renderComponent(
    <MarkdownViewer
      state={readyDocumentState}
      selectedSpecLabel={selectedSpec.label}
      selectedFileLabel={taskFile.label}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector('[aria-label="Markdown source preview"]')
      ?.textContent,
  ).toContain("Layout components");
  result.unmount();
});
