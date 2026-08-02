import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ViewModeToolbar } from "@/features/diff/components/ViewModeToolbar";

test("利用不可のDiff tabは理由を公開しclickとkeyboard選択を無視する", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onModeChange = vi.fn();

  act(() => {
    root.render(
      <ViewModeToolbar
        mode="specs"
        activeItemLabel="implementation-plan.md"
        diffAvailability={{
          status: "unavailable",
          reason: "Git repositoryではありません",
        }}
        onModeChange={onModeChange}
      />,
    );
  });

  const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  const specsTab = tabs[0]!;
  const diffTab = tabs[1]!;
  expect(diffTab.getAttribute("aria-disabled")).toBe("true");
  expect(diffTab.title).toBe("Git repositoryではありません");

  act(() => {
    diffTab.click();
    specsTab.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });

  expect(onModeChange).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(diffTab);

  act(() => root.unmount());
  container.remove();
});
