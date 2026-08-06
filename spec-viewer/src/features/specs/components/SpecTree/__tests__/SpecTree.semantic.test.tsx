import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { SpecTree } from "@/features/specs/components/SpecTree";
import type { SpecFeatureError } from "@/features/specs/domain/specError";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";

const activeSpec = createSpecNodeFixture({
  id: "primary/active",
  label: "Active",
  sourceGroupId: "primary",
  relativeId: "active",
  presentDocumentCount: 3,
});
const archivedSpec = createSpecNodeFixture({
  id: "primary/.archive/old",
  label: "Old",
  sourceGroupId: "primary",
  relativeId: ".archive/old",
});
const archive = createSpecNodeFixture({
  id: "primary/.archive",
  label: "Archive",
  kind: "archive",
  sourceGroupId: "primary",
  relativeId: ".archive",
  descendantSpecCount: 1,
  children: [archivedSpec],
});
const secondarySpec = createSpecNodeFixture({
  id: "secondary/active",
  label: "Secondary Active",
  sourceGroupId: "secondary",
  relativeId: "active",
});
const sourceGroup = createSpecNodeFixture({
  id: "secondary",
  label: "Secondary",
  kind: "sourceGroup",
  sourceGroupId: "secondary",
  relativeId: ".",
  children: [secondarySpec],
});
const readyState = {
  status: "ready",
  workspacePath: "/workspace",
  tree: { specs: [activeSpec, archive, sourceGroup] },
  error: null,
} as const;

function renderTree(props: Partial<Parameters<typeof SpecTree>[0]> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSelectSpec = vi.fn();
  const onArchiveSpec = vi.fn();
  const onReload = vi.fn();

  act(() => {
    root.render(
      <SpecTree
        state={readyState}
        selectedSpecId={activeSpec.id}
        onSelectSpec={onSelectSpec}
        onArchiveSpec={onArchiveSpec}
        onReload={onReload}
        {...props}
      />,
    );
  });

  return {
    container,
    onSelectSpec,
    onArchiveSpec,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("SpecTreeはprimary implicit rootとsecondary headingを表示しArchiveを末尾でcollapsedにする", () => {
  const result = renderTree();
  const rootItems = result.container.querySelectorAll(
    ".spec-tree > .spec-tree__list > .spec-tree__node > .spec-tree__row .spec-tree__item",
  );

  expect([...rootItems].map((item) => item.textContent)).toEqual([
    "Active3",
    "Archive1",
    "Secondary1",
  ]);
  expect(result.container.textContent).not.toContain("Old");
  expect(result.container.querySelector("[role=tree]")).not.toBeNull();
  expect(rootItems[0]?.getAttribute("aria-level")).toBe("1");
  result.unmount();
});

test("SpecTreeはArchive配下を展開してもarchive actionを表示しない", () => {
  const result = renderTree();
  const expand = result.container.querySelector(
    '[aria-label="Archiveを展開"]',
  ) as HTMLElement;

  act(() => expand.click());

  expect(result.container.querySelector("[role=group]")).not.toBeNull();
  expect(result.container.textContent).toContain("Old");
  expect(
    result.container.querySelector('[aria-label="Oldをアーカイブへ移動"]'),
  ).toBeNull();
  result.unmount();
});

test("SpecTreeはEnterでcontainerを展開しSpaceでspecを選択する", () => {
  const result = renderTree({ selectedSpecId: null });
  const archiveRow = result.container.querySelector(
    '[data-node-kind="archive"]',
  ) as HTMLButtonElement;
  const activeRow = result.container.querySelector(
    '[data-node-kind="spec"]',
  ) as HTMLButtonElement;

  act(() => {
    archiveRow.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    activeRow.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
  });

  expect(archiveRow.getAttribute("aria-expanded")).toBe("true");
  expect(result.onSelectSpec).toHaveBeenCalledWith(activeSpec.id);
  result.unmount();
});

test("SpecTreeは失敗specの行内alertから同じarchiveをretryする", () => {
  const onRetryArchive = vi.fn();
  const error: SpecFeatureError = {
    feature: "specs",
    code: "specArchive",
    message: "Archive failed",
    cause: {
      command: "archive_spec",
      code: "specArchive",
      message: "Archive failed",
      raw: null,
    },
  };
  const result = renderTree({
    archiveFailure: { specId: activeSpec.id, error },
    onRetryArchive,
  });
  const retry = result.container.querySelector(
    "[role=alert] button",
  ) as HTMLButtonElement;

  act(() => retry.click());

  expect(result.container.querySelector("[role=alert]")?.textContent).toContain(
    "Archive failed",
  );
  expect(onRetryArchive).toHaveBeenCalledOnce();
  result.unmount();
});

test("SpecTreeはreveal missing alertからrefreshしprocessing中はtreeをbusyにする", () => {
  const onRefreshArchiveReveal = vi.fn();
  const result = renderTree({
    archiveReveal: {
      status: "missing",
      workspacePath: "/workspace",
      response: {
        archivedSpecId: activeSpec.id,
        archivePath: "/workspace/.archive/active",
        sourceGroupId: "primary",
        destinationNodeId: ".archive/active",
      },
    },
    archivingSpecId: activeSpec.id,
    onRefreshArchiveReveal,
  });
  const tree = result.container.querySelector(".spec-tree") as HTMLElement;
  const refresh = result.container.querySelector(
    ".spec-tree__notice button",
  ) as HTMLButtonElement;

  expect(tree.getAttribute("aria-busy")).toBe("true");
  expect(refresh.disabled).toBe(true);
  expect(result.onArchiveSpec).not.toHaveBeenCalled();
  result.unmount();
});
