import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { createFileReviewFixture } from "@/features/diff/components/DiffViewer/testFixtures";

const mountedContainers: HTMLDivElement[] = [];

afterEach(() => {
  mountedContainers.splice(0).forEach((container) => container.remove());
});

test("表示モードをclickとArrowRightでside-by-sideへ切り替える", () => {
  const result = renderViewer();
  const sideBySide = getButton(result.container, "Side by side");

  act(() => sideBySide.click());
  expect(sideBySide.getAttribute("aria-checked")).toBe("true");

  const inline = getButton(result.container, "Inline");
  act(() => {
    sideBySide.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  });
  expect(inline.getAttribute("aria-checked")).toBe("true");
  result.unmount();
});

test("previous・nextはchange block単位で移動し端点ではdisabledになる", () => {
  const result = renderViewer();
  const previous = getButton(result.container, "前の変更");
  const next = getButton(result.container, "次の変更");

  expect(previous.disabled).toBe(true);
  expect(next.disabled).toBe(false);
  expect(
    result.container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-0");

  act(() => next.click());
  expect(previous.disabled).toBe(false);
  expect(next.disabled).toBe(true);
  expect(
    result.container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-1");

  act(() => next.click());
  expect(
    result.container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-1");
  result.unmount();
});

test("offscreen changeへ移動するとwindowとactive rowを更新する", () => {
  const lines = [
    { kind: "removed" as const, text: "old first" },
    { kind: "added" as const, text: "new first" },
    { kind: "context" as const, text: "context" },
    ...Array.from({ length: 150 }, () => ({
      kind: "noNewline" as const,
      text: "\\ No newline at end of file",
    })),
    { kind: "removed" as const, text: "old second" },
    { kind: "added" as const, text: "new second" },
  ];
  const result = renderViewer(createFileReviewFixture({ lines }));
  const next = getButton(result.container, "次の変更");

  act(() => next.click());

  const scrollSurface = result.container.querySelector(
    ".diff-viewer__scroll-surface",
  ) as HTMLDivElement;
  expect(scrollSurface.scrollTop).toBeGreaterThan(0);
  expect(
    result.container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-1");
  result.unmount();
});

test("expandable context gapをbuttonで展開する", () => {
  const lines = Array.from({ length: 8 }, (_, index) => ({
    kind: "context" as const,
    text: `line ${index + 1}`,
  }));
  const result = renderViewer(createFileReviewFixture({ lines }));
  const expand = getButton(result.container, "省略した2行を展開");

  expect(
    result.container.querySelectorAll('[data-row-kind="content"]'),
  ).toHaveLength(6);
  act(() => expand.click());
  expect(
    result.container.querySelectorAll('[data-row-kind="content"]'),
  ).toHaveLength(8);
  result.unmount();
});

test("reviewが変わるとactive changeとexpanded gapをresetする", () => {
  const result = renderViewer();
  act(() => getButton(result.container, "次の変更").click());
  expect(
    result.container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-1");

  act(() => {
    result.root.render(
      <DiffViewer review={createFileReviewFixture({ fileKey: "tasks" })} />,
    );
  });
  expect(
    result.container
      .querySelector('[data-active="true"]')
      ?.getAttribute("data-change-id"),
  ).toBe("hunk-0-change-0");
  result.unmount();
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

function renderViewer(review = createFileReviewFixture()) {
  const container = document.createElement("div");
  document.body.append(container);
  mountedContainers.push(container);
  const root = createRoot(container);
  act(() => root.render(<DiffViewer review={review} />));

  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}
