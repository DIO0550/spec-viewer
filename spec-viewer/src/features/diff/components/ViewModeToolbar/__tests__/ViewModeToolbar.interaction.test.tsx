import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { ViewModeToolbar } from "@/features/diff/components/ViewModeToolbar";

test("ViewModeToolbarは選択中のモードを示しDiffへの切替を通知する", () => {
  const result = renderToolbar();
  const specsButton = result.container.querySelector<HTMLButtonElement>(
    '[role="tab"][aria-selected="true"]',
  );
  const diffButton = getTab(result.container, "Diff");

  expect(specsButton?.textContent).toBe("Specs");
  expect(specsButton?.getAttribute("tabindex")).toBe("0");
  expect(diffButton?.getAttribute("tabindex")).toBe("-1");
  expect(specsButton?.getAttribute("aria-controls")).toBeNull();
  expect(diffButton?.getAttribute("aria-controls")).toBeNull();

  act(() => {
    diffButton?.click();
  });

  expect(result.onModeChange).toHaveBeenCalledWith("diff");
  result.unmount();
});

test.each([
  ["ArrowRight", "Specs", "diff"],
  ["ArrowLeft", "Specs", "diff"],
  ["End", "Specs", "diff"],
  ["Home", "Diff", "specs"],
] as const)("ViewModeToolbarは%sで%sから%sへ切り替える", (key, initialLabel, expectedMode) => {
  const result = renderToolbar(initialLabel === "Specs" ? "specs" : "diff");
  const initialTab = getTab(result.container, initialLabel);

  act(() => {
    initialTab?.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
  });

  expect(result.onModeChange).toHaveBeenCalledWith(expectedMode);
  expect(document.activeElement?.textContent).toBe(
    expectedMode === "specs" ? "Specs" : "Diff",
  );
  result.unmount();
});

function getTab(
  container: HTMLDivElement,
  label: string,
): HTMLButtonElement | undefined {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ).find((button) => button.textContent === label);
}

function renderToolbar(mode: "specs" | "diff" = "specs"): Readonly<{
  container: HTMLDivElement;
  onModeChange: ReturnType<typeof vi.fn>;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onModeChange = vi.fn();

  act(() => {
    root.render(
      <ViewModeToolbar
        mode={mode}
        activeItemLabel="implementation-plan.md"
        onModeChange={onModeChange}
      />,
    );
  });

  return {
    container,
    onModeChange,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}
