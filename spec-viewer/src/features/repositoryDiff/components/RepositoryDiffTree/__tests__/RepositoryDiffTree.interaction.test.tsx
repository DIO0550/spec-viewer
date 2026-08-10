import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { RepositoryDiffTreeProps } from "@/features/repositoryDiff/components/RepositoryDiffTree";
import { RepositoryDiffTree } from "@/features/repositoryDiff/components/RepositoryDiffTree";
import type { RepositoryDiffTreeProjectionNode } from "@/features/repositoryDiff/domain/repositoryDiff";

const defaultNode: RepositoryDiffTreeProjectionNode = {
  id: "row:vendor",
  path: "vendor",
  name: "vendor",
  kind: "directory",
  entryKind: null,
  contentClassification: null,
  oldPath: null,
  change: null,
  ignored: true,
  deferredNodeId: "in1_vendor",
  children: {
    state: "deferred",
    items: [],
    nextCursor: null,
    message: null,
  },
};

function createNode(
  overrides: Partial<RepositoryDiffTreeProjectionNode> = {},
): RepositoryDiffTreeProjectionNode {
  return { ...defaultNode, ...overrides };
}

function renderTree(
  overrides: Partial<RepositoryDiffTreeProps> = {},
): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const defaultProps: RepositoryDiffTreeProps = {
    filter: "changed",
    nodes: [defaultNode],
    selectedPath: null,
    expandedPaths: [],
    availability: { status: "ready" },
    onSelectFile: vi.fn(),
    onToggleDirectory: vi.fn(),
  };
  act(() => {
    root.render(<RepositoryDiffTree {...defaultProps} {...overrides} />);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
        container.remove();
      });
    },
  };
}

test("RepositoryDiffTreeはnormal treeのfile・directory・selected stateを表示する", () => {
  const file = createNode({
    id: "row:file",
    path: "src/main.ts",
    name: "main.ts",
    kind: "file",
    entryKind: "regular",
    contentClassification: "text",
    change: "modified",
    ignored: false,
    deferredNodeId: null,
    children: { state: "loaded", items: [], nextCursor: null, message: null },
  });
  const directory = createNode({
    id: "row:src",
    path: "src",
    name: "src",
    kind: "directory",
    ignored: false,
    deferredNodeId: null,
    children: {
      state: "loaded",
      items: [file],
      nextCursor: null,
      message: null,
    },
  });
  const onSelectFile = vi.fn();
  const result = renderTree({
    nodes: [directory],
    expandedPaths: ["src"],
    selectedPath: "src/main.ts",
    onSelectFile,
  });

  const tree = result.container.querySelector('[role="tree"]');
  const rows =
    result.container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]');
  expect(tree?.getAttribute("aria-label")).toBe("変更ファイルツリー");
  expect(rows).toHaveLength(2);
  expect(rows[0]?.getAttribute("aria-expanded")).toBe("true");
  expect(rows[1]?.getAttribute("aria-selected")).toBe("true");
  expect(result.container.querySelector('[role="group"]')).not.toBeNull();
  act(() => {
    rows[1]?.click();
  });
  expect(onSelectFile).toHaveBeenCalledWith("src/main.ts");
  result.unmount();
});

test("RepositoryDiffTreeはdeferred directoryのexpandとlazy callbackを起動する", () => {
  const onToggleDirectory = vi.fn();
  const onLoadChildren = vi.fn();
  const result = renderTree({
    filter: "all",
    onToggleDirectory,
    onLoadChildren,
  });
  const row =
    result.container.querySelector<HTMLButtonElement>('[role="treeitem"]');

  act(() => {
    row?.click();
  });

  expect(onToggleDirectory).toHaveBeenCalledWith("vendor");
  expect(onLoadChildren).toHaveBeenCalledWith("in1_vendor", null);
  result.unmount();
});

test("RepositoryDiffTreeはfailed childのretryとnextCursorのload moreを通知する", () => {
  const onLoadChildren = vi.fn();
  const failed = createNode({
    children: {
      state: "failed",
      items: [],
      nextCursor: "cursor-retry",
      message: "stale cursor",
    },
  });
  const failedResult = renderTree({
    filter: "all",
    nodes: [failed],
    expandedPaths: ["vendor"],
    onLoadChildren,
  });
  const retry = Array.from(
    failedResult.container.querySelectorAll("button"),
  ).find((button) => button.textContent === "再試行");
  act(() => {
    retry?.click();
  });
  expect(onLoadChildren).toHaveBeenCalledWith("in1_vendor", "cursor-retry");
  failedResult.unmount();

  const loaded = createNode({
    children: {
      state: "loaded",
      items: [],
      nextCursor: "cursor-next",
      message: null,
    },
  });
  const loadMoreResult = renderTree({
    filter: "all",
    nodes: [loaded],
    expandedPaths: ["vendor"],
    onLoadChildren,
  });
  const loadMore = Array.from(
    loadMoreResult.container.querySelectorAll("button"),
  ).find((button) => button.textContent === "さらに読み込む");
  act(() => {
    loadMore?.click();
  });
  expect(onLoadChildren).toHaveBeenLastCalledWith("in1_vendor", "cursor-next");
  loadMoreResult.unmount();
});

test.each([
  [{ status: "loading" } as const, "Repository diffを読み込んでいます。"],
  [{ status: "empty" } as const, "変更ファイルはありません。"],
  [{ status: "error", message: "overview failed" } as const, "overview failed"],
  [{ status: "stale", message: "stale snapshot" } as const, "stale snapshot"],
])("RepositoryDiffTreeはloading・empty・error・staleをsafe stateとして通知する", (availability, message) => {
  const onRetry = vi.fn();
  const result = renderTree({
    nodes: [],
    availability,
    onRetry,
  });

  expect(result.container.textContent).toContain(message);
  if (availability.status === "error" || availability.status === "stale") {
    const retry = result.container.querySelector("button");
    act(() => {
      retry?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  }
  result.unmount();
});

test("RepositoryDiffTreeはArrow/Home/EndとEnterでroving focusとselectionを操作する", () => {
  const first = createNode({
    id: "row:first",
    path: "first.ts",
    name: "first.ts",
    kind: "file",
    entryKind: "regular",
    contentClassification: "text",
    change: "modified",
    ignored: false,
    deferredNodeId: null,
    children: { state: "loaded", items: [], nextCursor: null, message: null },
  });
  const second = createNode({
    id: "row:second",
    path: "second.ts",
    name: "second.ts",
    kind: "file",
    entryKind: "regular",
    contentClassification: "text",
    change: "added",
    ignored: false,
    deferredNodeId: null,
    children: { state: "loaded", items: [], nextCursor: null, message: null },
  });
  const onSelectFile = vi.fn();
  const result = renderTree({
    nodes: [first, second],
    onSelectFile,
  });
  const rows =
    result.container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]');

  act(() => {
    rows[0]?.focus();
    rows[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(rows[1]);

  act(() => {
    rows[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(rows[0]);

  act(() => {
    rows[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(rows[1]);

  act(() => {
    rows[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });
  expect(onSelectFile).toHaveBeenCalledWith("second.ts");
  result.unmount();
});

test("RepositoryDiffTreeは折りたたまれた子ディレクトリのArrowLeftで親のroving focusを復元する", () => {
  const child = createNode({
    id: "row:child",
    path: "src/nested",
    name: "nested",
    kind: "directory",
    entryKind: null,
    ignored: false,
    deferredNodeId: null,
    children: { state: "loaded", items: [], nextCursor: null, message: null },
  });
  const parent = createNode({
    id: "row:parent",
    path: "src",
    name: "src",
    kind: "directory",
    entryKind: null,
    ignored: false,
    deferredNodeId: null,
    children: {
      state: "loaded",
      items: [child],
      nextCursor: null,
      message: null,
    },
  });
  const result = renderTree({ nodes: [parent], expandedPaths: ["src"] });
  const rows =
    result.container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]');

  act(() => {
    rows[0]?.focus();
    rows[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(rows[1]);
  expect(rows[1]?.tabIndex).toBe(0);

  act(() => {
    rows[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(rows[0]);
  expect(rows[0]?.tabIndex).toBe(0);
  expect(rows[1]?.tabIndex).toBe(-1);
  result.unmount();
});

test.each([
  { label: "追加", token: "A", change: "added" as const },
  { label: "変更", token: "M", change: "modified" as const },
  { label: "削除", token: "D", change: "deleted" as const },
  { label: "名前変更", token: "R", change: "renamed" as const },
  { label: "コピー", token: "C", change: "copied" as const },
  { label: "種別変更", token: "T", change: "typeChanged" as const },
  { label: "未追跡", token: "U", change: "untracked" as const },
  { label: "変更なし", token: "—", change: null },
])("RepositoryDiffTreeはchange=%sのsafe labelを表示する", ({
  label,
  token,
  change,
}) => {
  const result = renderTree({
    nodes: [
      createNode({
        id: `row:status-${change ?? "unchanged"}`,
        path: "status.ts",
        name: "status.ts",
        kind: "file",
        entryKind: "regular",
        contentClassification: "text",
        change,
        ignored: false,
        deferredNodeId: null,
        children: {
          state: "loaded",
          items: [],
          nextCursor: null,
          message: null,
        },
      }),
    ],
  });

  expect(result.container.textContent).toContain(label);
  expect(
    result.container.querySelector(".repository-diff-tree__token")?.textContent,
  ).toBe(token);
  result.unmount();
});

test("RepositoryDiffTreeはbinary・ignored・submoduleをlabel付き非破壊表示する", () => {
  const binary = createNode({
    id: "row:binary",
    path: "asset.bin",
    name: "asset.bin",
    kind: "file",
    entryKind: "regular",
    contentClassification: "binary",
    change: null,
    ignored: false,
    deferredNodeId: null,
    children: { state: "loaded", items: [], nextCursor: null, message: null },
  });
  const ignored = createNode({
    id: "row:ignored",
    path: "ignored.log",
    name: "ignored.log",
    kind: "file",
    entryKind: "regular",
    contentClassification: "text",
    change: null,
    ignored: true,
    deferredNodeId: null,
    children: { state: "loaded", items: [], nextCursor: null, message: null },
  });
  const submodule = createNode({
    id: "row:submodule",
    path: "vendor/lib",
    name: "lib",
    kind: "directory",
    entryKind: "submodule",
    contentClassification: null,
    change: null,
    ignored: false,
    deferredNodeId: null,
    children: { state: "loaded", items: [], nextCursor: null, message: null },
  });
  const result = renderTree({ nodes: [binary, ignored, submodule] });
  const rows =
    result.container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]');

  expect(result.container.textContent).toContain("バイナリ");
  expect(result.container.textContent).toContain("無視");
  expect(result.container.textContent).toContain("サブモジュール");
  expect(rows[2]?.getAttribute("aria-expanded")).toBeNull();
  expect(
    rows[0]?.querySelector(".repository-diff-tree__token")?.textContent,
  ).toBe("B");
  expect(
    rows[1]?.querySelector(".repository-diff-tree__token")?.textContent,
  ).toBe("I");
  result.unmount();
});
