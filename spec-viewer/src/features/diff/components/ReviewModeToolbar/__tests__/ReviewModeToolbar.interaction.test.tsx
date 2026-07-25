import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { ReviewModeToolbar } from "@/features/diff/components/ReviewModeToolbar";

test("ReviewModeToolbarは選択中のモードを示しDiffへの切替を通知する", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onModeChange = vi.fn();

  act(() => {
    root.render(
      <ReviewModeToolbar
        mode="specs"
        filePath="implementation-plan.md"
        onModeChange={onModeChange}
      />,
    );
  });

  const specsButton = container.querySelector(
    '[role="tab"][aria-selected="true"]',
  );
  const diffButton = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Diff",
  );

  expect(specsButton?.textContent).toBe("Specs");

  act(() => {
    diffButton?.click();
  });

  expect(onModeChange).toHaveBeenCalledWith("diff");

  act(() => {
    root.unmount();
  });
  container.remove();
});
