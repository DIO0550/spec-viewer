import { act, createRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { MarkdownViewerPanel } from "@/features/specs/components/MarkdownViewer/MarkdownViewerPanel";
import { MarkdownViewerStatusPanel } from "@/features/specs/components/MarkdownViewer/MarkdownViewerStatusPanel";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import type { SpecDocument } from "@/features/specs/types/spec";

const workspacePath = "/workspace/spec-reviewer";

function renderComponent(component: ReactNode) {
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

function createDocument(contents: string | null): SpecDocument {
  return {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents,
    missing: false,
    blocks: [],
  };
}

function createReadyState(contents: string | null): SpecDocumentState {
  return {
    status: "ready",
    workspacePath,
    specId: "phase-1-viewer",
    fileKey: "tasks",
    document: createDocument(contents),
    error: null,
  };
}

test("MarkdownViewerPanelは共通tabpanel属性とref到達先を保持する", () => {
  const panelRef = createRef<HTMLElement>();
  const result = renderComponent(
    <MarkdownViewerPanel
      as="article"
      panelRef={panelRef}
      variant="html"
      interactionOverlayOpen={true}
    >
      <p>Rendered body</p>
    </MarkdownViewerPanel>,
  );
  const panel = result.container.querySelector("#markdown-viewer-panel");

  expect(panel?.tagName).toBe("ARTICLE");
  expect(panel?.getAttribute("role")).toBe("tabpanel");
  expect(panel?.getAttribute("tabindex")).toBe("-1");
  expect(panel?.className).toBe("markdown-viewer markdown-viewer--html");
  expect(panel?.getAttribute("data-viewer-overlay-open")).toBe("true");
  expect(panelRef.current).toBe(panel);
  result.unmount();
});

test.each([
  [
    "spec未選択",
    {
      status: "idle",
      workspacePath: null,
      specId: null,
      fileKey: null,
      document: null,
      error: null,
    } satisfies SpecDocumentState,
    null,
    "Specを選択",
  ],
  [
    "file未選択",
    {
      status: "idle",
      workspacePath,
      specId: "phase-1-viewer",
      fileKey: null,
      document: null,
      error: null,
    } satisfies SpecDocumentState,
    "Phase 1 Viewer",
    "ファイルを選択",
  ],
  [
    "missing",
    {
      status: "missing",
      workspacePath,
      specId: "phase-1-viewer",
      fileKey: "tasks",
      document: {
        ...createDocument(null),
        missing: true,
      },
      error: null,
    } satisfies SpecDocumentState,
    "Phase 1 Viewer",
    "ファイルが見つかりません",
  ],
  ["empty", createReadyState(" \n\t "), "Phase 1 Viewer", "ファイルは空です"],
])("MarkdownViewerStatusPanelは%s状態で既存表示を維持する", (_label, state, selectedSpecLabel, expectedText) => {
  const result = renderComponent(
    <MarkdownViewerStatusPanel
      state={state}
      selectedSpecLabel={selectedSpecLabel}
      panelRef={createRef<HTMLElement>()}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.textContent).toContain(expectedText);
  expect(
    result.container.querySelector("#markdown-viewer-panel")?.className,
  ).toBe("markdown-viewer markdown-viewer--center");
  result.unmount();
});

test("MarkdownViewerStatusPanelはloading状態でaria-liveとskeleton classを保持する", () => {
  const result = renderComponent(
    <MarkdownViewerStatusPanel
      state={{
        status: "loading",
        workspacePath,
        specId: "phase-1-viewer",
        fileKey: "tasks",
        document: null,
        error: null,
      }}
      selectedSpecLabel="Phase 1 Viewer"
      panelRef={createRef<HTMLElement>()}
      onReload={vi.fn()}
    />,
  );
  const panel = result.container.querySelector("#markdown-viewer-panel");

  expect(panel?.getAttribute("aria-live")).toBe("polite");
  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "Markdownを読み込み中",
  );
  expect(
    result.container.querySelector(".markdown-loading-skeleton"),
  ).not.toBeNull();
  result.unmount();
});

test("MarkdownViewerStatusPanelはerror状態でretryをonReloadへ委譲する", () => {
  const onReload = vi.fn();
  const result = renderComponent(
    <MarkdownViewerStatusPanel
      state={{
        status: "error",
        workspacePath,
        specId: "phase-1-viewer",
        fileKey: "tasks",
        document: null,
        error: {
          feature: "specs",
          code: "markdownRead",
          message: "Markdown file could not be read.",
          cause: {
            command: "read_spec_file",
            code: "markdownRead",
            message: "Markdown file could not be read.",
            raw: "Markdown file could not be read.",
          },
        },
      }}
      selectedSpecLabel="Phase 1 Viewer"
      panelRef={createRef<HTMLElement>()}
      onReload={onReload}
    />,
  );
  const retryButton = result.container.querySelector("button");

  act(() => {
    retryButton?.click();
  });

  expect(result.container.textContent).toContain("Markdownを読み込めません");
  expect(onReload).toHaveBeenCalledTimes(1);
  result.unmount();
});
