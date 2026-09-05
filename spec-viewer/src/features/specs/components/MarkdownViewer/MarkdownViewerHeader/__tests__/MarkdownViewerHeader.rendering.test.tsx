import { type ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { MarkdownViewerHeader } from "@/features/specs/components/MarkdownViewer/MarkdownViewerHeader";

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

function createDocumentSearchProps() {
  return {
    query: "alpha",
    statusText: "1/2",
    hasMatches: true,
    disabled: false,
    onQueryChange: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onClear: vi.fn(),
  };
}

test("MarkdownViewerHeaderはsemantic breadcrumb、h1、specとfile種別subtitle、pathを表示する", () => {
  const result = renderComponent(
    <MarkdownViewerHeader
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Notes"
      fileKey="tasks"
      fileTypeLabel="Direct Markdown"
      path="/workspace/spec-reviewer/docs/plans/tasks.md"
      htmlZoom={null}
      documentSearch={createDocumentSearchProps()}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent,
  ).toContain("Phase 1 Viewer / Notes");
  expect(result.container.querySelector("h1")?.textContent).toBe("Notes");
  expect(
    result.container.querySelector(".markdown-viewer__subtitle")?.textContent,
  ).toBe("Phase 1 Viewer · Direct Markdown");
  expect(
    result.container.querySelector(".markdown-viewer__path")?.textContent,
  ).toBe("/workspace/spec-reviewer/docs/plans/tasks.md");
  result.unmount();
});

test("MarkdownViewerHeaderはHTML zoom controlの表示とhandler委譲を維持する", () => {
  const onDecrease = vi.fn();
  const onIncrease = vi.fn();
  const result = renderComponent(
    <MarkdownViewerHeader
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      fileKey="tasks"
      path="/workspace/spec-reviewer/docs/plans/tasks.html"
      htmlZoom={{
        zoomPercentLabel: "100%",
        canDecrease: false,
        canIncrease: true,
        onDecrease,
        onIncrease,
      }}
      documentSearch={createDocumentSearchProps()}
      onReload={vi.fn()}
    />,
  );
  const decreaseButton = result.container.querySelector(
    '[aria-label="HTMLを縮小"]',
  ) as HTMLButtonElement;
  const increaseButton = result.container.querySelector(
    '[aria-label="HTMLを拡大"]',
  ) as HTMLButtonElement;

  act(() => {
    increaseButton.click();
  });

  expect(
    result.container.querySelector('[aria-label="HTML拡大率"]')?.textContent,
  ).toBe("100%");
  expect(decreaseButton.disabled).toBe(true);
  expect(increaseButton.disabled).toBe(false);
  expect(onDecrease).not.toHaveBeenCalled();
  expect(onIncrease).toHaveBeenCalledTimes(1);
  result.unmount();
});

test("MarkdownViewerHeaderはdocument searchの入力と移動操作をpropsへ委譲する", () => {
  const documentSearch = createDocumentSearchProps();
  const onReload = vi.fn();
  const result = renderComponent(
    <MarkdownViewerHeader
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      fileKey="tasks"
      path="/workspace/spec-reviewer/docs/plans/tasks.md"
      htmlZoom={null}
      documentSearch={documentSearch}
      onReload={onReload}
    />,
  );
  const searchInput = result.container.querySelector(
    '[aria-label="文書検索"]',
  ) as HTMLInputElement;
  const previousButton = result.container.querySelector(
    '[aria-label="前の一致へ"]',
  ) as HTMLButtonElement;
  const nextButton = result.container.querySelector(
    '[aria-label="次の一致へ"]',
  ) as HTMLButtonElement;
  const clearButton = result.container.querySelector(
    '[aria-label="文書検索をクリア"]',
  ) as HTMLButtonElement;
  const reloadButton = result.container.querySelector(
    '[aria-label="Markdownを再読み込み"]',
  ) as HTMLButtonElement;

  act(() => {
    searchInput.value = "beta";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  act(() => {
    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );
  });
  act(() => {
    previousButton.click();
    nextButton.click();
    clearButton.click();
    reloadButton.click();
  });

  expect(documentSearch.onQueryChange).toHaveBeenCalledWith("beta");
  expect(documentSearch.onNext).toHaveBeenCalledTimes(2);
  expect(documentSearch.onPrevious).toHaveBeenCalledTimes(2);
  expect(documentSearch.onClear).toHaveBeenCalledTimes(1);
  expect(onReload).toHaveBeenCalledTimes(1);
  expect(result.container.textContent).toContain("1/2");
  result.unmount();
});

test("MarkdownViewerHeaderはhtmlZoomがnullのときzoom controlを表示しない", () => {
  const result = renderComponent(
    <MarkdownViewerHeader
      selectedSpecLabel="Phase 1 Viewer"
      selectedFileLabel="Tasks"
      fileKey="tasks"
      path="/workspace/spec-reviewer/docs/plans/tasks.md"
      htmlZoom={null}
      documentSearch={{
        ...createDocumentSearchProps(),
        query: "",
        statusText: "0件",
        hasMatches: false,
      }}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.querySelector(".html-zoom-control")).toBeNull();
  const previousButton = result.container.querySelector(
    '[aria-label="前の一致へ"]',
  ) as HTMLButtonElement;

  expect(previousButton.disabled).toBe(true);
  result.unmount();
});
