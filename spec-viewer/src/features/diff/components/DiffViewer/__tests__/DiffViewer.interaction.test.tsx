import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import type {
  DiffProjectionViewMode,
  FileDiff,
} from "@/features/diff/domain/fileDiff";

function renderViewer(
  fileDiff: FileDiff = createDiffViewerFixture(),
  initialMode: DiffProjectionViewMode = "unified",
  initialChangeId: string | null = null,
): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  function Harness(): React.ReactElement {
    const [activeChangeId, setActiveChangeId] = useState(initialChangeId);
    return (
      <DiffViewer
        fileDiff={fileDiff}
        mode={initialMode}
        activeChangeId={activeChangeId}
        onActiveChangeIdChange={setActiveChangeId}
      />
    );
  }

  act(() => root.render(<Harness />));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("controlled Split modeでside-by-side rowsを描画する", () => {
  const view = renderViewer(createDiffViewerFixture(), "split");

  expect(
    view.container.querySelector(".diff-viewer__row--split"),
  ).not.toBeNull();
  expect(view.container.querySelector(".diff-viewer__mode-control")).toBeNull();
  expect(view.container.querySelector(".diff-viewer__header")).toBeNull();
  view.unmount();
});

test("previous・nextはcontrolled change idを更新し端点でdisabledになる", () => {
  const view = renderViewer();
  const previous = getButton(view.container, "前の変更");
  const next = getButton(view.container, "次の変更");

  expect(previous.disabled).toBe(true);
  expect(next.disabled).toBe(false);
  act(() => next.click());

  expect(previous.disabled).toBe(false);
  expect(next.disabled).toBe(true);
  expect(
    view.container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-1");
  view.unmount();
});

test("null jump targetは先頭changeを表示して親へ通知しない", () => {
  const onChange = vi.fn();
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() =>
    root.render(
      <DiffViewer
        fileDiff={createDiffViewerFixture()}
        mode="unified"
        activeChangeId={null}
        onActiveChangeIdChange={onChange}
      />,
    ),
  );

  expect(onChange).not.toHaveBeenCalled();
  expect(
    container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-0");
  act(() => root.unmount());
});

test("invalid jump targetは先頭changeへ妥当化して親へ通知する", () => {
  const onChange = vi.fn();
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() =>
    root.render(
      <DiffViewer
        fileDiff={createDiffViewerFixture()}
        mode="unified"
        activeChangeId="missing"
        onActiveChangeIdChange={onChange}
      />,
    ),
  );

  expect(onChange).toHaveBeenCalledWith("hunk-0-change-0");
  expect(
    container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-0");
  act(() => root.unmount());
});

test("expandable context gapを展開して既存row projectionを維持する", () => {
  const lines = Array.from({ length: 8 }, (_, index) => ({
    kind: "context" as const,
    text: `line ${index + 1}`,
  }));
  const view = renderViewer(createDiffViewerFixture({ lines }));
  const expand = getButton(view.container, "省略した2行を展開");

  expect(
    view.container.querySelectorAll('[data-row-kind="content"]'),
  ).toHaveLength(6);
  act(() => expand.click());
  expect(
    view.container.querySelectorAll('[data-row-kind="content"]'),
  ).toHaveLength(8);
  view.unmount();
});

function getButton(
  container: HTMLDivElement,
  label: string,
): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.textContent === label ||
      candidate.getAttribute("aria-label") === label,
  );
  expect(button, `button not found: ${label}`).toBeDefined();
  return button as HTMLButtonElement;
}
