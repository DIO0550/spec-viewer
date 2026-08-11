import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import App from "@/app/App";
import { RepositoryFileTabs } from "@/features/repositoryDiff/components/RepositoryFileTabs";
import { useRepositoryDiffNavigationState } from "@/features/repositoryDiff/hooks/useRepositoryDiffNavigationState";

test("Appはworkspace未選択の初期状態を表示する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  expect(container.textContent).toContain("Spec Reviewer");
  expect(container.textContent).toContain("ワークスペースが選択されていません");
  expect(
    container.querySelector('aside[aria-label="仕様一覧"]'),
  ).not.toBeNull();
  expect(
    container.querySelector('aside[aria-label="Mode navigation"]'),
  ).not.toBeNull();
  expect(container.querySelector("main.app-shell__content")).not.toBeNull();
  expect(
    container.querySelector('aside[aria-label="コメントサイドバー"]'),
  ).not.toBeNull();
  expect(container.textContent).toContain(
    "Worktree データはまだ利用できません",
  );

  act(() => {
    root.unmount();
  });
});

test("tree openからtabとactive detailへ接続しSpecs往復でも保持する", () => {
  const view = renderRepositoryHarness();

  click(view.container, "a.tsを開く");
  expect(view.container.querySelector('[role="tab"]')?.textContent).toContain(
    "a.ts",
  );
  expect(
    view.container.querySelector('[aria-label="active detail"]')?.textContent,
  ).toBe("a.ts");

  click(view.container, "Specs");
  expect(view.container.querySelector('[role="tablist"]')).toBeNull();
  click(view.container, "Diff");
  expect(
    view.container.querySelector('[aria-label="active detail"]')?.textContent,
  ).toBe("a.ts");
  view.unmount();
});

test("worktree A/Bを往復してopen tabとactive detailを分離する", () => {
  const view = renderRepositoryHarness();

  click(view.container, "a.tsを開く");
  click(view.container, "worktree B");
  click(view.container, "b.tsを開く");
  expect(
    view.container.querySelector('[aria-label="active detail"]')?.textContent,
  ).toBe("b.ts");

  click(view.container, "worktree A");
  expect(
    view.container.querySelector('[aria-label="active detail"]')?.textContent,
  ).toBe("a.ts");
  view.unmount();
});

test("snapshotでactive fileが消失すると右→左fallbackをdetailへ反映する", () => {
  const view = renderRepositoryHarness();

  click(view.container, "a.tsを開く");
  click(view.container, "b.tsを開く");
  click(view.container, "b.tsをsnapshotから削除");

  expect(
    Array.from(
      view.container.querySelectorAll<HTMLElement>('[role="tab"]'),
    ).map((tab) => tab.textContent),
  ).toEqual(["—a.ts"]);
  expect(
    view.container.querySelector('[aria-label="active detail"]')?.textContent,
  ).toBe("a.ts");
  view.unmount();
});

function RepositoryHarness(): React.ReactElement {
  const [worktreeId, setWorktreeId] = useState("worktree-a");
  const [mode, setMode] = useState<"specs" | "diff">("diff");
  const navigation = useRepositoryDiffNavigationState({
    workspaceId: "/workspace",
    worktreeId,
  });

  return (
    <div>
      <button type="button" onClick={() => setMode("specs")}>
        Specs
      </button>
      <button type="button" onClick={() => setMode("diff")}>
        Diff
      </button>
      <button type="button" onClick={() => setWorktreeId("worktree-a")}>
        worktree A
      </button>
      <button type="button" onClick={() => setWorktreeId("worktree-b")}>
        worktree B
      </button>
      <button type="button" onClick={() => navigation.actions.openPath("a.ts")}>
        a.tsを開く
      </button>
      <button type="button" onClick={() => navigation.actions.openPath("b.ts")}>
        b.tsを開く
      </button>
      <button
        type="button"
        onClick={() => navigation.actions.reconcile(["a.ts"], [])}
      >
        b.tsをsnapshotから削除
      </button>
      {mode === "diff" ? (
        <>
          <RepositoryFileTabs
            items={navigation.entry.openPaths.map((path) => ({
              path,
              change: null,
            }))}
            activePath={navigation.entry.activePath}
            onActivate={navigation.actions.activateTab}
            onClose={navigation.actions.closeTab}
          />
          <output aria-label="active detail">
            {navigation.entry.activePath}
          </output>
        </>
      ) : (
        <p>Specs content</p>
      )}
    </div>
  );
}

function renderRepositoryHarness(): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<RepositoryHarness />));
  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

function click(container: HTMLDivElement, label: string): void {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  expect(button).toBeDefined();
  act(() => button?.click());
}
