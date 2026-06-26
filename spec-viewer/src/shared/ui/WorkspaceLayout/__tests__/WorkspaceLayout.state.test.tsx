import { act } from "react";
import type { ReactElement, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { ThemeProvider } from "@/features/preferences";
import type {
  SpecDocumentState,
  SpecTreeState,
  SpecDocument,
  SpecFile,
  SpecNode,
  SpecTreeData as SpecTreeShape,
} from "@/features/specs";
import { MarkdownViewer, SpecTabs, SpecTree } from "@/features/specs";
import { WorkspaceToolbar } from "@/features/workspace";
import { WorkspaceLayout } from "@/shared/ui/WorkspaceLayout";

const workspacePath = "/workspace/spec-reviewer";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.style.colorScheme = "";
});

const taskFile: SpecFile = {
  key: "tasks",
  label: "Tasks",
  fileName: "tasks.md",
  status: "present",
};

const implFile: SpecFile = {
  key: "impl",
  label: "Implementation",
  fileName: "implementation-plan.md",
  status: "missing",
};

const techReferenceFile: SpecFile = {
  key: "tech-reference",
  label: "Tech Reference",
  fileName: "tech-reference.html",
  status: "missing",
  format: "html",
};

const testCasesFile: SpecFile = {
  key: "test-cases",
  label: "Test Cases",
  fileName: "test-cases.html",
  status: "missing",
  format: "html",
};

const explorationFile: SpecFile = {
  key: "exploration",
  label: "Exploration",
  fileName: "exploration-report.md",
  status: "present",
};

const hearingFile: SpecFile = {
  key: "hearing",
  label: "Hearing",
  fileName: "hearing-notes.md",
  status: "present",
};

const selectedSpec: SpecNode = {
  id: "phase-1-viewer",
  label: "Phase 1 Viewer",
  files: [taskFile, implFile],
  children: [
    {
      id: "phase-1-comments",
      label: "Phase 1 Comments",
      files: [taskFile],
      children: [],
    },
  ],
};

const readyTree: SpecTreeShape = {
  specs: [selectedSpec],
};

const issueTreeState: SpecTreeState = {
  status: "ready",
  workspacePath: "/workspace",
  tree: {
    specs: [
      {
        id: "021-issue-262",
        label: "021-issue-262",
        files: [taskFile, implFile],
        children: [
          {
            id: "021-issue-262/code-review",
            label: "code-review",
            files: [implFile],
            children: [],
          },
        ],
      },
    ],
  },
  error: null,
};

const readyTreeState: SpecTreeState = {
  status: "ready",
  workspacePath,
  tree: readyTree,
  error: null,
};

const readyDocument: SpecDocument = {
  key: "tasks",
  path: "/workspace/spec-reviewer/docs/plans/tasks.md",
  contents: "# Phase 1 Viewer\n\n- Layout components",
  missing: false,
  blocks: [],
};

const readyDocumentState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: selectedSpec.id,
  fileKey: "tasks",
  document: readyDocument,
  error: null,
};

type RenderResult = Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}>;

function renderComponent(component: ReactNode): RenderResult {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ThemeProvider>{component}</ThemeProvider>);
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

type TestWorkspaceLayoutProps = Readonly<{
  toolbar: ReactNode;
  leftHeader?: ReactNode;
  sidebar: ReactNode;
  tabs: ReactNode;
  viewer: ReactNode;
  comments: ReactNode;
  leftOpen?: boolean;
  leftWidth?: number;
  leftMinWidth?: number;
  leftMaxWidth?: number;
  onOpenLeft?: () => void;
  onCloseLeft?: () => void;
  onLeftWidthChange?: (width: number) => void;
  commentsOpen?: boolean;
  commentsWidth?: number;
  commentsMinWidth?: number;
  commentsMaxWidth?: number;
  onOpenComments?: () => void;
  onCloseComments?: () => void;
  onCommentsWidthChange?: (width: number) => void;
}>;

/** @returns WorkspaceLayout composed with the slots used by tests. */
function TestWorkspaceLayout(props: TestWorkspaceLayoutProps): ReactElement {
  const {
    toolbar,
    leftHeader,
    sidebar,
    tabs,
    viewer,
    comments,
    leftOpen,
    leftWidth,
    leftMinWidth,
    leftMaxWidth,
    onOpenLeft,
    onCloseLeft,
    onLeftWidthChange,
    commentsOpen,
    commentsWidth,
    commentsMinWidth,
    commentsMaxWidth,
    onOpenComments,
    onCloseComments,
    onCommentsWidthChange,
  } = props;

  return (
    <WorkspaceLayout.Root
      leftNavigation={{
        isOpen: leftOpen,
        width: leftWidth,
        minWidth: leftMinWidth,
        maxWidth: leftMaxWidth,
        onOpen: onOpenLeft,
        onClose: onCloseLeft,
        onWidthChange: onLeftWidthChange,
      }}
      commentsSidebar={{
        isOpen: commentsOpen,
        width: commentsWidth,
        minWidth: commentsMinWidth,
        maxWidth: commentsMaxWidth,
        onOpen: onOpenComments,
        onClose: onCloseComments,
        onWidthChange: onCommentsWidthChange,
      }}
    >
      <WorkspaceLayout.LeftNavigation header={leftHeader}>
        {sidebar}
      </WorkspaceLayout.LeftNavigation>
      <WorkspaceLayout.Main>
        <WorkspaceLayout.Toolbar>{toolbar}</WorkspaceLayout.Toolbar>
        <WorkspaceLayout.Tabs>{tabs}</WorkspaceLayout.Tabs>
        <WorkspaceLayout.Viewer>{viewer}</WorkspaceLayout.Viewer>
      </WorkspaceLayout.Main>
      <WorkspaceLayout.Comments>{comments}</WorkspaceLayout.Comments>
    </WorkspaceLayout.Root>
  );
}

test("WorkspaceLayoutはtoolbar、tree、tabs、viewer、comment sidebarを表示する", () => {
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={
        <WorkspaceToolbar
          workspacePath={workspacePath}
          inputValue={workspacePath}
          isLoading={false}
          isBrowsing={false}
          errorMessage={null}
          refreshStatus={{ status: "idle", message: null }}
          canRefresh={true}
          onInputChange={vi.fn()}
          onBrowse={vi.fn()}
          onLoad={vi.fn()}
          onRefresh={vi.fn()}
          onReset={vi.fn()}
        />
      }
      sidebar={
        <SpecTree
          state={readyTreeState}
          selectedSpecId={selectedSpec.id}
          onSelectSpec={vi.fn()}
          onReload={vi.fn()}
        />
      }
      tabs={
        <SpecTabs
          spec={selectedSpec}
          selectedFileKey="tasks"
          onSelectFile={vi.fn()}
        />
      }
      viewer={
        <MarkdownViewer
          state={readyDocumentState}
          selectedSpecLabel={selectedSpec.label}
          selectedFileLabel={taskFile.label}
          onReload={vi.fn()}
        />
      }
      comments={<div>Comments</div>}
    />,
  );

  expect(
    result.container.querySelector('[aria-label="ワークスペース操作"]'),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="Specツリー"]'),
  ).not.toBeNull();
  expect(result.container.querySelector('[role="tablist"]')).not.toBeNull();
  expect(
    result.container.querySelector("#markdown-viewer-panel"),
  ).not.toBeNull();
  expect(
    result.container.querySelector('[aria-label="コメントサイドバー"]'),
  ).not.toBeNull();
  result.unmount();
});

test("SpecTabsはbackendの6タブ順をそのまま表示する", () => {
  const result = renderComponent(
    <SpecTabs
      spec={{
        id: "tech-reference-tab",
        label: "Tech Reference Tab",
        files: [
          implFile,
          taskFile,
          techReferenceFile,
          testCasesFile,
          explorationFile,
          hearingFile,
        ],
        children: [],
      }}
      selectedFileKey="tech-reference"
      onSelectFile={vi.fn()}
    />,
  );
  const labels = Array.from(
    result.container.querySelectorAll(".spec-tabs__label"),
  ).map((element) => element.textContent);

  expect(labels).toEqual([
    "Implementation",
    "Tasks",
    "Tech Reference",
    "Test Cases",
    "Exploration",
    "Hearing",
  ]);
  result.unmount();
});

test("WorkspaceLayoutはコメントサイドバーを閉じると再オープン導線を表示する", () => {
  const onOpenComments = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      commentsOpen={false}
      onOpenComments={onOpenComments}
    />,
  );
  const body = result.container.querySelector(".app-shell__body");
  const commentsSidebar = result.container.querySelector(
    '[aria-label="コメントサイドバー"]',
  );
  const reopenButton = result.container.querySelector(
    '[aria-label="サイドバーを開く"]',
  ) as HTMLButtonElement;

  act(() => {
    reopenButton.click();
  });

  expect(body?.getAttribute("data-comments-sidebar")).toBe("collapsed");
  expect(commentsSidebar?.getAttribute("aria-hidden")).toBe("true");
  expect(onOpenComments).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceLayoutは左ナビゲーションを閉じた状態で表示領域を広げる", () => {
  const onOpenLeftNavigation = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      leftOpen={false}
      onOpenLeft={onOpenLeftNavigation}
    />,
  );
  const body = result.container.querySelector(".app-shell__body");
  const leftNavigation = result.container.querySelector(
    '[aria-label="仕様一覧"]',
  );
  const openButton = result.container.querySelector(
    '[aria-label="仕様一覧を開く"]',
  ) as HTMLButtonElement;

  act(() => {
    openButton.click();
  });

  expect(body?.getAttribute("data-left-navigation")).toBe("collapsed");
  expect(leftNavigation?.getAttribute("aria-hidden")).toBe("true");
  expect(onOpenLeftNavigation).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceLayoutは左ナビゲーション内の閉じる操作を発火する", () => {
  const onCloseLeftNavigation = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<button type="button">Tree item</button>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      leftOpen={true}
      onCloseLeft={onCloseLeftNavigation}
    />,
  );
  const closeButton = result.container.querySelector(
    '[aria-label="仕様一覧を閉じる"]',
  ) as HTMLButtonElement;

  act(() => {
    closeButton.click();
  });

  expect(onCloseLeftNavigation).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceLayoutはEscapeで開いている左ナビゲーションを閉じる", () => {
  const onCloseLeftNavigation = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<button type="button">Tree item</button>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      leftOpen={true}
      onCloseLeft={onCloseLeftNavigation}
    />,
  );
  const leftNavigation = result.container.querySelector(
    '[aria-label="仕様一覧"]',
  ) as HTMLElement;

  act(() => {
    leftNavigation.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCloseLeftNavigation).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceLayoutはドラッグで左ナビゲーション幅を変更する", () => {
  const onLeftNavigationWidthChange = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      leftOpen={true}
      leftWidth={268}
      leftMinWidth={216}
      leftMaxWidth={420}
      onLeftWidthChange={onLeftNavigationWidthChange}
    />,
  );
  const body = result.container.querySelector(
    ".app-shell__body",
  ) as HTMLElement;
  const resizeHandle = result.container.querySelector(
    '[aria-label="仕様一覧の幅を変更"]',
  ) as HTMLButtonElement;

  body.getBoundingClientRect = () =>
    ({
      left: 20,
    }) as DOMRect;

  act(() => {
    resizeHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 320,
        pointerId: 1,
      }),
    );
  });

  expect(onLeftNavigationWidthChange).toHaveBeenCalledWith(300);
  result.unmount();
});

test("WorkspaceLayoutはEscapeで開いているコメントサイドバーを閉じる", () => {
  const onCloseComments = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<button type="button">コメント操作</button>}
      commentsOpen={true}
      onCloseComments={onCloseComments}
    />,
  );
  const body = result.container.querySelector(
    ".app-shell__body",
  ) as HTMLElement;

  act(() => {
    body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onCloseComments).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceLayoutはドラッグでコメントサイドバー幅を変更する", () => {
  const onCommentsWidthChange = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      commentsWidth={360}
      commentsMinWidth={280}
      commentsMaxWidth={560}
      onCommentsWidthChange={onCommentsWidthChange}
    />,
  );
  const body = result.container.querySelector(
    ".app-shell__body",
  ) as HTMLElement;
  const resizeHandle = result.container.querySelector(
    '[aria-label="サイドバー幅を変更"]',
  ) as HTMLButtonElement;

  body.getBoundingClientRect = () =>
    ({
      right: 1000,
    }) as DOMRect;

  act(() => {
    resizeHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 620,
        pointerId: 1,
      }),
    );
  });

  expect(onCommentsWidthChange).toHaveBeenCalledWith(380);
  result.unmount();
});

test("WorkspaceLayoutはキーボードでコメントサイドバー幅を変更する", () => {
  const onCommentsWidthChange = vi.fn();
  const result = renderComponent(
    <TestWorkspaceLayout
      toolbar={<div>Toolbar</div>}
      sidebar={<div>Tree</div>}
      tabs={<div>Tabs</div>}
      viewer={<div>Viewer</div>}
      comments={<div>コメント本文</div>}
      commentsWidth={360}
      commentsMinWidth={280}
      commentsMaxWidth={560}
      onCommentsWidthChange={onCommentsWidthChange}
    />,
  );
  const resizeHandle = result.container.querySelector(
    '[aria-label="サイドバー幅を変更"]',
  ) as HTMLButtonElement;

  act(() => {
    resizeHandle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  });

  expect(onCommentsWidthChange).toHaveBeenCalledWith(376);
  result.unmount();
});

test("SpecTreeはspec選択イベントを発火する", () => {
  const onSelectSpec = vi.fn();
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId={null}
      onSelectSpec={onSelectSpec}
      onReload={vi.fn()}
    />,
  );
  const button = result.container.querySelector(
    ".spec-tree__item",
  ) as HTMLButtonElement;

  act(() => {
    button.click();
  });

  expect(onSelectSpec).toHaveBeenCalledWith("phase-1-viewer");
  result.unmount();
});

test("SpecTreeはアーカイブ中でも描画済みspec選択を発火する", () => {
  const onSelectSpec = vi.fn();
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId={null}
      archivingSpecId="phase-1-viewer"
      onSelectSpec={onSelectSpec}
      onReload={vi.fn()}
    />,
  );
  const button = result.container.querySelector(
    ".spec-tree__item",
  ) as HTMLButtonElement;

  act(() => {
    button.click();
  });

  expect(button.disabled).toBe(false);
  expect(onSelectSpec).toHaveBeenCalledWith("phase-1-viewer");
  result.unmount();
});

test("SpecTreeはspec行のアーカイブ操作を発火する", () => {
  const onArchiveSpec = vi.fn();
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onArchiveSpec={onArchiveSpec}
      onReload={vi.fn()}
    />,
  );
  const button = result.container.querySelector(
    '[aria-label="Phase 1 Viewerをアーカイブへ移動"]',
  ) as HTMLButtonElement;

  act(() => {
    button.click();
  });

  expect(onArchiveSpec).toHaveBeenCalledWith("phase-1-viewer");
  result.unmount();
});

test("SpecTreeはアーカイブ中にreloadとarchiveを発火しない", () => {
  const onArchiveSpec = vi.fn();
  const onReload = vi.fn();
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId={null}
      archivingSpecId="phase-1-viewer"
      onSelectSpec={vi.fn()}
      onArchiveSpec={onArchiveSpec}
      onReload={onReload}
    />,
  );
  const refreshButton = result.container.querySelector(
    '[aria-label="Specツリーを再読み込み"]',
  ) as HTMLButtonElement;
  const archiveButton = result.container.querySelector(
    '[aria-label="Phase 1 Viewerをアーカイブへ移動"]',
  ) as HTMLButtonElement;

  act(() => {
    refreshButton.click();
    archiveButton.click();
  });

  expect(refreshButton.disabled).toBe(true);
  expect(archiveButton.disabled).toBe(true);
  expect(onReload).not.toHaveBeenCalled();
  expect(onArchiveSpec).not.toHaveBeenCalled();
  result.unmount();
});

test.each([
  [
    "error",
    {
      status: "error",
      workspacePath,
      tree: null,
      error: {
        code: "specTreeScan",
        message: "Spec directory could not be scanned.",
        raw: "Spec directory could not be scanned.",
      },
    } satisfies SpecTreeState,
  ],
  [
    "empty",
    {
      status: "empty",
      workspacePath,
      tree: { specs: [] },
      error: null,
    } satisfies SpecTreeState,
  ],
])("SpecTreeはアーカイブ中に%s状態のreloadを発火しない", (_label, state) => {
  const onReload = vi.fn();
  const result = renderComponent(
    <SpecTree
      state={state}
      selectedSpecId={null}
      archivingSpecId="phase-1-viewer"
      onSelectSpec={vi.fn()}
      onReload={onReload}
    />,
  );
  const button = result.container.querySelector("button") as HTMLButtonElement;

  act(() => {
    button.click();
  });

  expect(button.disabled).toBe(true);
  expect(onReload).not.toHaveBeenCalled();
  result.unmount();
});

test("SpecTreeはsource group rootにはアーカイブ操作を表示しない", () => {
  const sourceGroupTreeState: SpecTreeState = {
    status: "ready",
    workspacePath,
    tree: {
      specs: [
        {
          id: ".plugin-workspace/.specs",
          label: "ルート",
          files: [],
          children: [selectedSpec],
        },
      ],
    },
    error: null,
  };
  const result = renderComponent(
    <SpecTree
      state={sourceGroupTreeState}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onArchiveSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector('[aria-label="ルートをアーカイブへ移動"]'),
  ).toBeNull();
  result.unmount();
});

test.each([
  [
    "idle",
    {
      status: "idle",
      workspacePath: null,
      tree: null,
      error: null,
    } satisfies SpecTreeState,
  ],
  [
    "loading",
    {
      status: "loading",
      workspacePath,
      tree: null,
      error: null,
    } satisfies SpecTreeState,
  ],
  [
    "error",
    {
      status: "error",
      workspacePath,
      tree: null,
      error: {
        code: "specTreeScan",
        message: "Spec directory could not be scanned.",
        raw: "Spec directory could not be scanned.",
      },
    } satisfies SpecTreeState,
  ],
  [
    "empty",
    {
      status: "empty",
      workspacePath,
      tree: { specs: [] },
      error: null,
    } satisfies SpecTreeState,
  ],
])("SpecTreeは%s中にselection UIを描画しない", (_status, state) => {
  const result = renderComponent(
    <SpecTree
      state={state}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.querySelector(".spec-tree__item")).toBeNull();
  result.unmount();
});

test("SpecTreeは読み込み中にskeleton statusを表示する", () => {
  const result = renderComponent(
    <SpecTree
      state={{
        status: "loading",
        workspacePath,
        tree: null,
        error: null,
      }}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );

  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "Specファイルをスキャン中",
  );
  expect(
    result.container.querySelectorAll(".loading-skeleton__bar").length,
  ).toBeGreaterThan(0);
  result.unmount();
});

test("SpecTreeは矢印キーでtree itemのfocusを移動する", () => {
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId="phase-1-comments"
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  const buttons = result.container.querySelectorAll(".spec-tree__item");

  act(() => {
    (buttons[0] as HTMLButtonElement).focus();
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });

  expect(document.activeElement).toBe(buttons[1]);
  result.unmount();
});

test("SpecTreeは左右矢印キーで親子tree itemへfocusを移動する", () => {
  const result = renderComponent(
    <SpecTree
      state={readyTreeState}
      selectedSpecId="phase-1-comments"
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  const buttons = result.container.querySelectorAll(".spec-tree__item");

  act(() => {
    (buttons[0] as HTMLButtonElement).focus();
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });

  expect(document.activeElement).toBe(buttons[1]);

  act(() => {
    buttons[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  });

  expect(document.activeElement).toBe(buttons[0]);
  result.unmount();
});

test("SpecTreeはissueフォルダ単位を表示して子フォルダを展開できる", () => {
  const result = renderComponent(
    <SpecTree
      state={issueTreeState}
      selectedSpecId={null}
      onSelectSpec={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  const issueButton = result.container.querySelector(
    '[aria-label="021-issue-262を展開"]',
  ) as HTMLButtonElement;

  expect(result.container.textContent).toContain("021-issue-262");
  expect(result.container.textContent).not.toContain("code-review");

  act(() => {
    issueButton.click();
  });

  expect(issueButton.getAttribute("aria-expanded")).toBe("true");
  expect(result.container.textContent).toContain("code-review");
  result.unmount();
});

test.each([
  ["spec未選択", null],
  [
    "files空",
    {
      ...selectedSpec,
      files: [],
    },
  ],
])("SpecTabsは%sならtabを描画しない", (_label, spec) => {
  const result = renderComponent(
    <SpecTabs spec={spec} selectedFileKey={null} onSelectFile={vi.fn()} />,
  );

  expect(result.container.querySelector('[role="tab"]')).toBeNull();
  result.unmount();
});

test("SpecTabsは選択中tabとfile選択イベントを表現する", () => {
  const onSelectFile = vi.fn();
  const result = renderComponent(
    <SpecTabs
      spec={selectedSpec}
      selectedFileKey="tasks"
      onSelectFile={onSelectFile}
    />,
  );
  const tabs = result.container.querySelectorAll('[role="tab"]');

  expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
  expect(tabs[1]?.textContent).toContain("missing");

  act(() => {
    (tabs[1] as HTMLButtonElement).click();
  });

  expect(onSelectFile).toHaveBeenCalledWith("impl");
  result.unmount();
});

test("SpecTabsは矢印キーで隣のtabを選択する", () => {
  const onSelectFile = vi.fn();
  const result = renderComponent(
    <SpecTabs
      spec={selectedSpec}
      selectedFileKey="tasks"
      onSelectFile={onSelectFile}
    />,
  );
  const tabs = result.container.querySelectorAll('[role="tab"]');

  act(() => {
    (tabs[0] as HTMLButtonElement).focus();
    tabs[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });

  expect(onSelectFile).toHaveBeenCalledWith("impl");
  result.unmount();
});

test("WorkspaceToolbarはopen workspace操作を発火する", () => {
  const onBrowse = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={null}
      inputValue=""
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={false}
      onInputChange={vi.fn()}
      onBrowse={onBrowse}
      onLoad={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
    />,
  );
  const openButton = result.container.querySelector(
    '[aria-label="ワークスペースフォルダを開く"]',
  ) as HTMLButtonElement;

  act(() => {
    openButton.click();
  });

  expect(onBrowse).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceToolbarはパス入力のsubmitでworkspace読み込みを発火する", () => {
  const onLoad = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={null}
      inputValue="/workspace/spec-reviewer"
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={false}
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={onLoad}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
    />,
  );
  const form = result.container.querySelector(
    '[aria-label="ワークスペース操作"]',
  ) as HTMLFormElement;

  act(() => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });

  expect(onLoad).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceToolbarはcurrent view refresh操作と状態を表示する", () => {
  const onRefresh = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={workspacePath}
      inputValue={workspacePath}
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{
        status: "stale",
        message: "Content may be stale. Refresh to retry.",
      }}
      canRefresh={true}
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={onRefresh}
      onReset={vi.fn()}
    />,
  );
  const refreshButton = result.container.querySelector(
    '[aria-label="現在の表示を再読み込み"]',
  ) as HTMLButtonElement;

  expect(result.container.textContent).toContain("Content may be stale");

  act(() => {
    refreshButton.click();
  });

  expect(onRefresh).toHaveBeenCalledOnce();
  result.unmount();
});

test("WorkspaceToolbarはrefresh不可ならcurrent view refreshを発火しない", () => {
  const onRefresh = vi.fn();
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={workspacePath}
      inputValue={workspacePath}
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={false}
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={onRefresh}
      onReset={vi.fn()}
    />,
  );
  const refreshButton = result.container.querySelector(
    '[aria-label="現在の表示を再読み込み"]',
  ) as HTMLButtonElement;

  act(() => {
    refreshButton.click();
  });

  expect(refreshButton.disabled).toBe(true);
  expect(onRefresh).not.toHaveBeenCalled();
  result.unmount();
});

test("WorkspaceToolbarはtheme mode変更をContext経由でdocumentへ反映する", () => {
  const result = renderComponent(
    <WorkspaceToolbar
      workspacePath={workspacePath}
      inputValue={workspacePath}
      isLoading={false}
      isBrowsing={false}
      errorMessage={null}
      refreshStatus={{ status: "idle", message: null }}
      canRefresh={true}
      onInputChange={vi.fn()}
      onBrowse={vi.fn()}
      onLoad={vi.fn()}
      onRefresh={vi.fn()}
      onReset={vi.fn()}
    />,
  );
  const themeSelect = result.container.querySelector(
    "#theme-mode",
  ) as HTMLSelectElement;

  act(() => {
    themeSelect.value = "dark";
    themeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.themeMode).toBe("dark");
  result.unmount();
});

test("MarkdownViewerは読み込み中状態をrole statusで表示する", () => {
  const loadingState: SpecDocumentState = {
    status: "loading",
    workspacePath,
    specId: selectedSpec.id,
    fileKey: "tasks",
    document: null,
    error: null,
  };
  const result = renderComponent(
    <MarkdownViewer
      state={loadingState}
      selectedSpecLabel={selectedSpec.label}
      selectedFileLabel={taskFile.label}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector('[role="status"]')?.textContent,
  ).toContain("Markdownを読み込み中");
  result.unmount();
});

test("MarkdownViewerはMarkdownをHTMLとして表示する", () => {
  const result = renderComponent(
    <MarkdownViewer
      state={readyDocumentState}
      selectedSpecLabel={selectedSpec.label}
      selectedFileLabel={taskFile.label}
      onReload={vi.fn()}
    />,
  );

  expect(
    result.container.querySelector(
      '[aria-label="レンダリング済みMarkdownドキュメント"]',
    )?.textContent,
  ).toContain("Layout components");
  result.unmount();
});
