import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { WorktreeTree } from "@/features/workspace/components/WorktreeTree";
import type { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";

const nodes: readonly WorktreeTreeNode[] = [
  {
    kind: "category",
    id: "category:agents",
    label: "Agents",
    children: [
      {
        kind: "worktree",
        id: "one",
        label: "One",
        count: { kind: "spec-count", value: 0 },
      },
    ],
  },
  {
    kind: "worktree",
    id: "two",
    label: "Two",
    count: { kind: "changed-file-count", value: 2 },
  },
];

test("WorktreeTreeは2種類のcountとARIA treeを表示する", () => {
  const result = renderTree();

  expect(result.container.querySelector('[role="tree"]')).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="仕様 0件"]')?.textContent,
  ).toBe("0");
  expect(
    result.container.querySelector('[aria-label="変更ファイル 2件"]')
      ?.textContent,
  ).toBe("2");
  expect(
    result.container.querySelector('[role="treeitem"][aria-expanded="true"]'),
  ).not.toBeNull();
  expect(result.container.querySelector('[role="group"]')).not.toBeNull();
  const items =
    result.container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]');
  expect(items[0]?.style.paddingInlineStart).toBe("10px");
  expect(items[1]?.style.paddingInlineStart).toBe("26px");
  result.unmount();
});

test("WorktreeTreeは矢印とEnterでleafを選択する", () => {
  const onSelect = vi.fn();
  const result = renderTree(onSelect);
  const items =
    result.container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]');

  act(() => {
    items[0]?.focus();
    items[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(items[1]);

  act(() => {
    items[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  expect(onSelect).toHaveBeenCalledWith("one");
  result.unmount();
});

test("WorktreeTreeは空状態をstatusとして通知する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(
      <WorktreeTree
        nodes={[]}
        selectedWorktreeId={null}
        emptyLabel="Worktree はありません"
        onSelectWorktree={vi.fn()}
      />,
    );
  });

  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "Worktree はありません",
  );
  act(() => {
    root.unmount();
  });
});

function renderTree(onSelect = vi.fn()): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <WorktreeTree
        nodes={nodes}
        selectedWorktreeId={null}
        emptyLabel="empty"
        onSelectWorktree={onSelect}
      />,
    );
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

test("nodes更新で消失category IDをpruneし再追加時は初期展開する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const categoryNodes = nodes.slice(0, 1);

  act(() => {
    root.render(
      <WorktreeTree
        nodes={categoryNodes}
        selectedWorktreeId={null}
        emptyLabel="empty"
        onSelectWorktree={vi.fn()}
      />,
    );
  });
  const category = container.querySelector<HTMLButtonElement>(
    "[role=treeitem][aria-expanded=true]",
  );
  act(() => {
    category?.click();
  });
  expect(category?.getAttribute("aria-expanded")).toBe("false");

  act(() => {
    root.render(
      <WorktreeTree
        nodes={[]}
        selectedWorktreeId={null}
        emptyLabel="empty"
        onSelectWorktree={vi.fn()}
      />,
    );
  });
  act(() => {
    root.render(
      <WorktreeTree
        nodes={categoryNodes}
        selectedWorktreeId={null}
        emptyLabel="empty"
        onSelectWorktree={vi.fn()}
      />,
    );
  });

  expect(
    container.querySelector("[role=treeitem]")?.getAttribute("aria-expanded"),
  ).toBe("true");
  act(() => {
    root.unmount();
  });
});
