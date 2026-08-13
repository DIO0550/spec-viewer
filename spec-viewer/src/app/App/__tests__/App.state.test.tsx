import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import App from "@/app/App";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import { RepositoryFileTabs } from "@/features/repositoryDiff/components/RepositoryFileTabs";
import { useRepositoryDiffNavigationState } from "@/features/repositoryDiff/hooks/useRepositoryDiffNavigationState";

import { toDiffViewerFileDiff } from "@/features/repositoryDiff/lib/projectRepositoryDiff";
const RepositoryReviewFixture = createDiffViewerFixture({
  newContent: "current",
}).review;

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

test("[R199-ERR-004] snapshotでactive fileが消失すると右→左fallbackをdetailへ反映する", () => {
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

test("[R199-VIEW-006] 3 modeとtabを跨いでもpath別active changeを維持する", () => {
  const view = renderRepositoryHarness();

  click(view.container, "a.tsを開く");
  click(view.container, "change-2へ移動");
  click(view.container, "Split");
  click(view.container, "Editor");
  click(view.container, "b.tsを開く");
  click(view.container, "change-bへ移動");
  click(view.container, "a.ts tab");
  click(view.container, "Unified");

  expect(
    view.container.querySelector('[aria-label="active change"]')?.textContent,
  ).toBe("change-2");
  click(view.container, "Editor");
  expect(
    view.container.querySelector('[aria-label="active change"]')?.textContent,
  ).toBe("change-2");
  view.unmount();
});

test("refreshではnavigation entryを維持しrevision変更時だけviewer local stateをresetする", () => {
  const view = renderRepositoryHarness();

  click(view.container, "a.tsを開く");
  click(view.container, "Editor");
  click(view.container, "change-2へ移動");
  click(view.container, "peekを開く");
  click(view.container, "同じrevisionでrefresh");

  expect(
    view.container.querySelector('[aria-label="active detail"]')?.textContent,
  ).toBe("a.ts");
  expect(
    view.container.querySelector('[aria-label="active change"]')?.textContent,
  ).toBe("change-2");
  expect(
    view.container.querySelector('[aria-label="viewer local state"]')
      ?.textContent,
  ).toBe("expanded");

  click(view.container, "新revisionでrefresh");

  expect(
    view.container.querySelector('[aria-label="active detail"]')?.textContent,
  ).toBe("a.ts");
  expect(
    view.container.querySelector('[aria-label="active change"]')?.textContent,
  ).toBe("change-2");
  expect(
    view.container.querySelector('[aria-label="viewer local state"]')
      ?.textContent,
  ).toBe("collapsed");
  view.unmount();
});

function RepositoryHarness(): React.ReactElement {
  const [worktreeId, setWorktreeId] = useState("worktree-a");
  const [mode, setMode] = useState<"specs" | "diff">("diff");
  const [revisionSourceId, setRevisionSourceId] = useState("snapshot-1");
  const [, rerenderForRefresh] = useState(0);
  const navigation = useRepositoryDiffNavigationState({
    workspaceId: "/workspace",
    worktreeId,
  });
  const activePath = navigation.entry.activePath;
  const editorFileDiff =
    activePath === null
      ? null
      : toDiffViewerFileDiff(RepositoryReviewFixture, {
          worktreeId,
          snapshotId: revisionSourceId,
          path: activePath,
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
        onClick={() => navigation.actions.changeViewerMode("unified")}
      >
        Unified
      </button>
      <button
        type="button"
        onClick={() => navigation.actions.changeViewerMode("split")}
      >
        Split
      </button>
      <button
        type="button"
        onClick={() => navigation.actions.changeViewerMode("editor")}
      >
        Editor
      </button>
      <button
        type="button"
        onClick={() => navigation.actions.activateTab("a.ts")}
      >
        a.ts tab
      </button>
      <button
        type="button"
        onClick={() => navigation.actions.changeJumpTarget("a.ts", "change-2")}
      >
        change-2へ移動
      </button>
      <button
        type="button"
        onClick={() => navigation.actions.changeJumpTarget("b.ts", "change-b")}
      >
        change-bへ移動
      </button>
      <button
        type="button"
        onClick={() => rerenderForRefresh((generation) => generation + 1)}
      >
        同じrevisionでrefresh
      </button>
      <button type="button" onClick={() => setRevisionSourceId("snapshot-2")}>
        新revisionでrefresh
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
          <output aria-label="active change">
            {navigation.entry.activePath === null
              ? null
              : navigation.entry.jumpTargetsByPath[navigation.entry.activePath]}
          </output>
          {navigation.entry.viewerMode === "editor" &&
          editorFileDiff !== null ? (
            <ViewerLocalState
              revisionKey={`${editorFileDiff.identity.sourceId}:${editorFileDiff.identity.path}`}
            />
          ) : null}
        </>
      ) : (
        <p>Specs content</p>
      )}
    </div>
  );
}

/**
 * Models the viewer-local display state owned by CurrentFileViewer.
 *
 * @param props - Opaque revision identity supplied by App.
 * @returns Controls that expose reset behavior for App interaction tests.
 */
function ViewerLocalState(
  props: Readonly<{ revisionKey: string }>,
): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [props.revisionKey]);

  return (
    <>
      <button type="button" onClick={() => setExpanded(true)}>
        peekを開く
      </button>
      <output aria-label="viewer local state">
        {expanded ? "expanded" : "collapsed"}
      </output>
    </>
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
