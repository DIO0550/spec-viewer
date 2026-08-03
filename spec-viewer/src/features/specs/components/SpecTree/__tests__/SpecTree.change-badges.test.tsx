import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SpecTree } from "@/features/specs/components/SpecTree";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";
import type { SpecTreeState } from "@/features/specs/hooks/useSpecs";

test("openable Spec行だけにaccessibleなM/U badgeを表示する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const state: SpecTreeState = {
    status: "ready",
    workspacePath: "/workspace",
    tree: {
      specs: [
        createSpecNodeFixture({
          id: "modified-spec",
          label: "Modified Spec",
        }),
        createSpecNodeFixture({
          id: "untracked-spec",
          label: "Untracked Spec",
        }),
        createSpecNodeFixture({
          id: "category",
          label: "Category",
          kind: "category",
        }),
      ],
    },
    error: null,
  };

  act(() => {
    root.render(
      <SpecTree
        state={state}
        selectedSpecId={null}
        changeBadgesBySpecId={
          new Map([
            ["modified-spec", "M"],
            ["untracked-spec", "U"],
            ["category", "M"],
          ])
        }
        onSelectSpec={vi.fn()}
        onReload={vi.fn()}
      />,
    );
  });

  expect(container.querySelector('[aria-label="変更あり"]')?.textContent).toBe(
    "M",
  );
  expect(
    container.querySelector('[aria-label="未追跡の変更あり"]')?.textContent,
  ).toBe("U");
  expect(container.querySelectorAll(".spec-tree__change-badge")).toHaveLength(
    2,
  );

  act(() => root.unmount());
});
