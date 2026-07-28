import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  type Comment,
  CommentSidebar,
  createTextHash,
} from "@/features/comments";
import { CommentId } from "@/features/comments/domain/commentId";
import {
  ChangesNavigation,
  DiffWorkspace,
  type ViewMode,
  ViewModeToolbar,
} from "@/features/diff";
import { ThemeProvider } from "@/features/preferences";
import type {
  MarkdownBlockMetadata,
  SpecDocument,
  SpecDocumentState,
  SpecFileKey,
  SpecNode,
  SpecTreeData as SpecTreeShape,
  SpecTreeState,
} from "@/features/specs";
import { MarkdownViewer, SpecTabs, SpecTree } from "@/features/specs";
import {
  WorkspaceSidebarSection,
  WorktreeTree,
  WorkspaceToolbar,
} from "@/features/workspace";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";

const workspacePath = "/workspace/pdfmod";
const worktreeName = "agent-a1b3ff42";
const worktreeWorkspacePath = `/workspace/pdfmod/.worktrees/${worktreeName}`;
const commentId = CommentId.fromString;

type StoryWorktree = Readonly<{
  name: string;
  icon: string;
  changeCount: number;
  isMuted?: boolean;
}>;

const storyWorktrees: readonly StoryWorktree[] = [
  { name: "root", icon: "⌂", changeCount: 0 },
  { name: "549", icon: "▣", changeCount: 2 },
  { name: worktreeName, icon: "⑂", changeCount: 4 },
  { name: "agent-a049b1c8", icon: "⑂", changeCount: 0 },
  { name: "agent-a395fbe1", icon: "⑂", changeCount: 1 },
  { name: "agent-a5b8a0d3", icon: "⑂", changeCount: 2 },
  { name: "agent-a65ad1a4", icon: "⑂", changeCount: 7 },
  { name: "archive", icon: "▱", changeCount: 12, isMuted: true },
];

const sampleSpec: SpecNode = {
  id: "041-preview-task",
  label: "041-preview-task",
  files: [
    {
      key: "exploration",
      label: "exploration.md",
      fileName: "exploration.md",
      status: "present",
    },
    {
      key: "hearing",
      label: "hearing.md",
      fileName: "hearing.md",
      status: "present",
    },
    {
      key: "impl",
      label: "impl.md",
      fileName: "impl.md",
      status: "present",
    },
    {
      key: "tasks",
      label: "tasks.md",
      fileName: "tasks.md",
      status: "missing",
    },
  ],
  children: [],
};

const sampleTree: SpecTreeShape = {
  specs: [
    {
      id: "040-delete-task-flow",
      label: "040-delete-task-flow",
      files: sampleSpec.files,
      children: [],
    },
    sampleSpec,
    {
      id: "042-cache-invalidation",
      label: "042-cache-invalidation",
      files: sampleSpec.files.slice(0, 3),
      children: [],
    },
    {
      id: "archive",
      label: "archive",
      files: [],
      children: [
        {
          id: "archive/039-legacy-preview",
          label: "039-legacy-preview",
          files: sampleSpec.files,
          children: [],
        },
      ],
    },
  ],
};

const implementationHeading = "Implementation";
const sampleBlocks: readonly MarkdownBlockMetadata[] = [
  {
    blockType: "heading",
    blockIndex: 0,
    textHash: createTextHash("Implementation"),
    textSnippet: "Implementation",
    sourceRange: null,
  },
  {
    blockType: "paragraph",
    blockIndex: 1,
    textHash: createTextHash("041-preview-task · impl"),
    textSnippet: "041-preview-task · impl",
    sourceRange: null,
  },
  {
    blockType: "paragraph",
    blockIndex: 2,
    textHash: createTextHash(
      "タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",
    ),
    textSnippet:
      "タスクプレビューの実装方針を、既存の QuickView 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",
    sourceRange: null,
  },
  {
    blockType: "heading",
    blockIndex: 3,
    textHash: createTextHash("現状の課題"),
    textSnippet: "現状の課題",
    sourceRange: null,
  },
  {
    blockType: "list_item",
    blockIndex: 4,
    textHash: createTextHash("プレビュー起動フローが複数入口に散らばっている"),
    textSnippet: "プレビュー起動フローが複数入口に散らばっている",
    sourceRange: null,
  },
  {
    blockType: "list_item",
    blockIndex: 5,
    textHash: createTextHash(
      "大きなタスクを開いたときの描画コストが線形に増える",
    ),
    textSnippet: "大きなタスクを開いたときの描画コストが線形に増える",
    sourceRange: null,
  },
  {
    blockType: "list_item",
    blockIndex: 6,
    textHash: createTextHash(
      "権限のないタスクを掴んだときのエラーハンドリングが弱い",
    ),
    textSnippet: "権限のないタスクを掴んだときのエラーハンドリングが弱い",
    sourceRange: null,
  },
  {
    blockType: "heading",
    blockIndex: 7,
    textHash: createTextHash("検討した選択肢"),
    textSnippet: "検討した選択肢",
    sourceRange: null,
  },
  {
    blockType: "table",
    blockIndex: 8,
    textHash: createTextHash(
      "OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred",
    ),
    textSnippet:
      "OPTION VERDICT A 既存 QuickView をそのままタスクにも流用 rejected B QuickView をラップした TaskPreview を新規に薄く作る accepted C プレビュー基盤ごと書き直す deferred",
    sourceRange: null,
  },
  {
    blockType: "heading",
    blockIndex: 9,
    textHash: createTextHash("決定事項"),
    textSnippet: "決定事項",
    sourceRange: null,
  },
  {
    blockType: "paragraph",
    blockIndex: 10,
    textHash: createTextHash(
      "選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。",
    ),
    textSnippet:
      "選択肢 B を採用する。既存の QuickView をラップした TaskPreview を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。",
    sourceRange: null,
  },
];

const sampleDocument: SpecDocument = {
  key: "impl",
  path: `${workspacePath}/.plugin-workspace/.specs/041-preview-task/impl.md`,
  contents: [
    "# Implementation",
    "",
    "`041-preview-task · impl`",
    "",
    "タスクプレビューの実装方針を、既存の `QuickView` 相当機能との統合方針を含めて決める。認証と描画性能の 2 軸で判断する。",
    "",
    "## 現状の課題",
    "",
    "- プレビュー起動フローが複数入口に散らばっている",
    "- 大きなタスクを開いたときの描画コストが線形に増える",
    "- 権限のないタスクを掴んだときのエラーハンドリングが弱い",
    "",
    "## 検討した選択肢",
    "",
    "| OPTION | | VERDICT |",
    "| --- | --- | --- |",
    "| A | 既存 QuickView をそのままタスクにも流用 | rejected |",
    "| B | **QuickView をラップした TaskPreview を新規に薄く作る** | accepted |",
    "| C | プレビュー基盤ごと書き直す | deferred |",
    "",
    "## 決定事項",
    "",
    "選択肢 B を採用する。既存の QuickView をラップした `TaskPreview` を薄く作り、タスク固有の権限チェックと空状態のみを新規実装する。描画は既存パスに委譲。",
  ].join("\n"),
  missing: false,
  blocks: sampleBlocks,
};

const readyTreeState: SpecTreeState = {
  status: "ready",
  workspacePath,
  tree: sampleTree,
  error: null,
};

const readyDocumentState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: sampleSpec.id,
  fileKey: "impl",
  document: sampleDocument,
  error: null,
};

const readyWorktreeTreeState: SpecTreeState = {
  ...readyTreeState,
  workspacePath: worktreeWorkspacePath,
};

const readyWorktreeDocumentState: SpecDocumentState = {
  ...readyDocumentState,
  workspacePath: worktreeWorkspacePath,
  document: {
    ...sampleDocument,
    path: `${worktreeWorkspacePath}/.plugin-workspace/.specs/041-preview-task/impl.md`,
  },
};

const sampleComments: readonly Comment[] = [
  {
    id: commentId("cmt_story_open_1"),
    anchor: {
      fileKey: "impl",
      blockType: "heading",
      blockIndex: 0,
      textHash: createTextHash(implementationHeading),
      textSnippet: "scorer.ts L16 · calcFu",
      charRange: { start: 0, end: 14 },
    },
    body: "ctx が undefined のとき落ちる。null チェックいる?",
    status: "open",
    createdAt: "2026-07-25T12:00:00Z",
    updatedAt: "2026-07-25T12:00:00Z",
  },
  {
    id: commentId("cmt_story_open_2"),
    anchor: {
      fileKey: "impl",
      blockType: "heading",
      blockIndex: 0,
      textHash: createTextHash(implementationHeading),
      textSnippet: "pinfu.ts L10 · checkAllRuns",
      charRange: { start: 0, end: 14 },
    },
    body: "agent-a5b8a0d3 は shapes を Map で持ってた。どっちが速いか計測したい",
    status: "open",
    createdAt: "2026-07-25T10:00:00Z",
    updatedAt: "2026-07-25T10:00:00Z",
  },
  {
    id: commentId("cmt_story_open_3"),
    anchor: {
      fileKey: "impl",
      blockType: "heading",
      blockIndex: 0,
      textHash: createTextHash(implementationHeading),
      textSnippet: "scorer.ts L14 · score()",
      charRange: { start: 0, end: 14 },
    },
    body: "戻り値の Result 型、hands/*.ts と重複してるフィールドあり",
    status: "open",
    createdAt: "2026-07-25T08:00:00Z",
    updatedAt: "2026-07-25T08:00:00Z",
  },
  {
    id: commentId("cmt_story_resolved"),
    anchor: {
      fileKey: "impl",
      blockType: "heading",
      blockIndex: 0,
      textHash: createTextHash(implementationHeading),
      textSnippet: "implementation decision",
      charRange: { start: 0, end: 14 },
    },
    body: "描画経路の統合方針を反映済み。",
    status: "resolved",
    createdAt: "2026-07-24T08:00:00Z",
    updatedAt: "2026-07-24T09:00:00Z",
  },
];

type WorkspaceLayoutStoryProps = Readonly<{
  pathbar: ReactNode;
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

/**
 * @param props - Storybook control props for the composed layout.
 * @returns WorkspaceLayout composed for Storybook controls.
 */
function WorkspaceLayoutStory(props: WorkspaceLayoutStoryProps) {
  const {
    pathbar,
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
  const [storyLeftOpen, setStoryLeftOpen] = useState(leftOpen ?? true);
  const [storyLeftWidth, setStoryLeftWidth] = useState(leftWidth ?? 240);
  const [storyCommentsOpen, setStoryCommentsOpen] = useState(
    commentsOpen ?? true,
  );
  const [storyCommentsWidth, setStoryCommentsWidth] = useState(
    commentsWidth ?? 300,
  );

  return (
    <WorkspaceLayout.Root
      worktrees={{
        isOpen: storyLeftOpen,
        width: storyLeftWidth,
        minWidth: leftMinWidth,
        maxWidth: leftMaxWidth,
        onOpen: () => {
          setStoryLeftOpen(true);
          onOpenLeft?.();
        },
        onClose: () => {
          setStoryLeftOpen(false);
          onCloseLeft?.();
        },
        onWidthChange: (width) => {
          setStoryLeftWidth(width);
          onLeftWidthChange?.(width);
        },
      }}
      comments={{
        isOpen: storyCommentsOpen,
        width: storyCommentsWidth,
        minWidth: commentsMinWidth,
        maxWidth: commentsMaxWidth,
        onOpen: () => {
          setStoryCommentsOpen(true);
          onOpenComments?.();
        },
        onClose: () => {
          setStoryCommentsOpen(false);
          onCloseComments?.();
        },
        onWidthChange: (width) => {
          setStoryCommentsWidth(width);
          onCommentsWidthChange?.(width);
        },
      }}
    >
      <WorkspaceLayout.Pathbar>{pathbar}</WorkspaceLayout.Pathbar>
      <WorkspaceLayout.Toolbar>{toolbar}</WorkspaceLayout.Toolbar>
      <WorkspaceLayout.Worktrees header={leftHeader}>
        {sidebar}
      </WorkspaceLayout.Worktrees>
      <WorkspaceLayout.ModeNavigation>{tabs}</WorkspaceLayout.ModeNavigation>
      <WorkspaceLayout.Content>{viewer}</WorkspaceLayout.Content>
      <WorkspaceLayout.Comments>{comments}</WorkspaceLayout.Comments>
    </WorkspaceLayout.Root>
  );
}

const meta = {
  component: WorkspaceLayoutStory,
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: Object.fromEntries(
        [1200, 1199, 900, 899, 761, 760].map((width) => [
          "width-" + width,
          {
            name: width + "px",
            styles: { width: width + "px", height: "800px" },
          },
        ]),
      ),
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    pathbar: { control: false },
    toolbar: { control: false },
    sidebar: { control: false },
    tabs: { control: false },
    viewer: { control: false },
    comments: { control: false },
  },
} satisfies Meta<typeof WorkspaceLayoutStory>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Verifies that a worktree Story keeps its path and selected tree row aligned.
 *
 * @param canvasElement - Rendered Story canvas.
 */
async function verifyWorktreeOpenStory(
  canvasElement: HTMLElement,
): Promise<void> {
  const canvas = within(canvasElement);

  await expect(canvas.getByRole("textbox", { name: "PATH" })).toHaveValue(
    worktreeWorkspacePath,
  );
  await expect(
    canvas.getByRole("treeitem", { name: new RegExp(worktreeName) }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    canvas.getByRole("button", { name: `${worktreeName}を開く` }),
  ).toHaveAttribute("aria-current", "location");
}

/**
 * Verifies that the Specs list only scrolls vertically.
 *
 * @param canvasElement - Rendered Story canvas.
 */
async function verifyShellAccessibility(
  canvasElement: HTMLElement,
): Promise<void> {
  const canvas = within(canvasElement);
  const selectedWorktree = canvas.getByRole("treeitem", { name: /root/ });
  const specsTab = canvas.getByRole("tab", { name: "Specs" });
  const diffTab = canvas.getByRole("tab", { name: "Diff" });
  const separators = canvas.getAllByRole("separator");
  const toolbar = canvasElement.querySelector<HTMLElement>(
    ".app-shell__toolbar",
  );
  const toolbarContent = canvasElement.querySelector<HTMLElement>(
    ".app-shell__toolbar-content",
  );

  await expect(getComputedStyle(toolbar as HTMLElement).overflowX).toBe(
    "hidden",
  );
  await expect(
    getComputedStyle(toolbarContent as HTMLElement).gridColumnStart,
  ).toBe("2");
  await expect((toolbarContent as HTMLElement).clientWidth).toBe(
    (toolbar as HTMLElement).clientWidth,
  );
  await expect(selectedWorktree).toHaveAttribute("aria-current", "page");
  await expect(specsTab).toHaveAttribute("aria-selected", "true");
  await expect(separators).toHaveLength(3);
  for (const separator of separators) {
    await expect(separator).toHaveAttribute("aria-valuenow");
  }

  await userEvent.click(specsTab);
  await userEvent.keyboard("{ArrowRight}");
  await expect(diffTab).toHaveFocus();

  await userEvent.click(
    canvas.getByRole("button", { name: "仕様一覧を閉じる" }),
  );
  const reopenWorktrees = canvas.getByRole("button", {
    name: "仕様一覧を開く",
  });
  await waitFor(async () => {
    await expect(reopenWorktrees).toHaveFocus();
  });
  await userEvent.click(reopenWorktrees);
  await waitFor(async () => {
    await expect(
      canvas.getByRole("button", { name: "仕様一覧を閉じる" }),
    ).toHaveFocus();
  });

  const closeComments = canvasElement.querySelector<HTMLButtonElement>(
    ".app-shell__comments-close",
  );
  await expect(closeComments).toBeVisible();
  await userEvent.click(closeComments as HTMLButtonElement);
  const reopenComments = canvas.getByRole("button", {
    name: "サイドバーを開く",
  });
  await waitFor(async () => {
    await expect(reopenComments).toHaveFocus();
  });
  await userEvent.click(reopenComments);
  await waitFor(async () => {
    await expect(closeComments).toHaveFocus();
  });
}

/**
 * Verifies that the Specs list only scrolls vertically.
 *
 *  canvasElement - Rendered Story canvas.
 */
async function verifySpecsListHasNoHorizontalOverflow(
  canvasElement: HTMLElement,
): Promise<void> {
  const specsList = canvasElement.querySelector<HTMLElement>(
    ".app-shell__mode-navigation .spec-tree__list",
  );

  await expect(specsList).toBeInstanceOf(HTMLElement);

  const renderedSpecsList = specsList as HTMLElement;

  await expect(renderedSpecsList.scrollWidth).toBeLessThanOrEqual(
    renderedSpecsList.clientWidth,
  );
}

const readySpecsArgs = createShellArgs({
  treeState: readyTreeState,
  documentState: readyDocumentState,
  selectedSpec: sampleSpec,
  selectedFileKey: "impl",
  workspaceInput: workspacePath,
  workspaceStatusPath: workspacePath,
});

export const Default: Story = {
  name: "Specs",
  args: readySpecsArgs,
  play: async ({ canvasElement }) => {
    await verifySpecsListHasNoHorizontalOverflow(canvasElement);
    await verifyShellAccessibility(canvasElement);
  },
};

export const AllProps: Story = {
  args: {
    ...readySpecsArgs,
    leftWidth: 420,
    commentsWidth: 560,
  },
};

export const EdgeCases: Story = {
  args: {
    ...readySpecsArgs,
    leftOpen: false,
    commentsOpen: false,
  },
};

export const Viewport1200: Story = {
  args: readySpecsArgs,
  parameters: { viewport: { defaultViewport: "width-1200" } },
};
export const Viewport1199: Story = {
  args: readySpecsArgs,
  parameters: { viewport: { defaultViewport: "width-1199" } },
};
export const Viewport900: Story = {
  args: readySpecsArgs,
  parameters: { viewport: { defaultViewport: "width-900" } },
};
export const Viewport899: Story = {
  args: readySpecsArgs,
  parameters: { viewport: { defaultViewport: "width-899" } },
};
export const Viewport761: Story = {
  args: readySpecsArgs,
  parameters: { viewport: { defaultViewport: "width-761" } },
};
export const Viewport760: Story = {
  args: readySpecsArgs,
  parameters: { viewport: { defaultViewport: "width-760" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "仕様一覧を閉じる" }),
    );
    const closeComments = canvasElement.querySelector<HTMLButtonElement>(
      ".app-shell__comments-close",
    );
    await expect(closeComments).toBeVisible();
    await userEvent.click(closeComments as HTMLButtonElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Specs" }));
    await userEvent.click(
      canvas.getByRole("region", { name: "Spec document" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "サイドバーを開く" }),
    );
  },
};

export const Diff: Story = {
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    viewMode: "diff",
  }),
};

export const WorktreeOpen: Story = {
  args: createShellArgs({
    treeState: readyWorktreeTreeState,
    documentState: readyWorktreeDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: worktreeWorkspacePath,
    workspaceStatusPath: worktreeWorkspacePath,
    activeWorktreeName: worktreeName,
  }),
  play: async ({ canvasElement }) => {
    await verifyWorktreeOpenStory(canvasElement);
  },
};

export const WorktreeDiff: Story = {
  args: createShellArgs({
    treeState: readyWorktreeTreeState,
    documentState: readyWorktreeDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: worktreeWorkspacePath,
    workspaceStatusPath: worktreeWorkspacePath,
    activeWorktreeName: worktreeName,
    viewMode: "diff",
  }),
  play: async ({ canvasElement }) => {
    await verifyWorktreeOpenStory(canvasElement);
  },
};

export const Archiving: Story = {
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    archivingSpecId: sampleSpec.id,
  }),
};

export const Loading: Story = {
  args: createShellArgs({
    treeState: {
      status: "loading",
      workspacePath,
      tree: null,
      error: null,
    },
    documentState: {
      status: "loading",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "impl",
      document: null,
      error: null,
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    isWorkspaceLoading: true,
  }),
};

export const Empty: Story = {
  args: createShellArgs({
    treeState: {
      status: "empty",
      workspacePath,
      tree: { specs: [] },
      error: null,
    },
    documentState: {
      status: "idle",
      workspacePath,
      specId: null,
      fileKey: null,
      document: null,
      error: null,
    },
    selectedSpec: null,
    selectedFileKey: null,
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
  }),
};

export const Error: Story = {
  args: createShellArgs({
    treeState: {
      status: "error",
      workspacePath,
      tree: null,
      error: {
        feature: "specs",
        code: "specTreeScan",
        message: "Spec directory could not be scanned.",
        cause: {
          command: "list_specs",
          code: "specTreeScan",
          message: "Spec directory could not be scanned.",
          raw: "Spec directory could not be scanned.",
        },
      },
    },
    documentState: {
      status: "error",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "impl",
      document: null,
      error: {
        feature: "specs",
        code: "markdownRead",
        message: "Markdown file could not be read.",
        cause: {
          command: "read_spec_file",
          code: "markdownRead",
          message: "Markdown file could not be read.",
          raw: "Markdown file could not be read.",
        },
      },
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "impl",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    workspaceErrorMessage: "Workspace loaded with file warnings.",
  }),
};

type ShellArgsOptions = Readonly<{
  treeState: SpecTreeState;
  documentState: SpecDocumentState;
  selectedSpec: SpecNode | null;
  selectedFileKey: SpecFileKey | null;
  workspaceInput: string;
  workspaceStatusPath: string | null;
  workspaceErrorMessage?: string;
  isWorkspaceLoading?: boolean;
  archivingSpecId?: string | null;
  viewMode?: ViewMode;
  activeWorktreeName?: string | null;
}>;

/** @returns WorkspaceLayout story args for a representative viewer state. */
function createShellArgs({
  treeState,
  documentState,
  selectedSpec,
  selectedFileKey,
  workspaceInput,
  workspaceStatusPath,
  workspaceErrorMessage = undefined,
  isWorkspaceLoading = false,
  archivingSpecId = null,
  viewMode = "specs",
  activeWorktreeName = null,
}: ShellArgsOptions): ComponentProps<typeof WorkspaceLayoutStory> {
  const selectedFile =
    selectedSpec?.files.find((file) => file.key === selectedFileKey) ?? null;
  let viewer: ReactNode;

  if (viewMode === "diff") {
    viewer = (
      <DiffWorkspace
        selectedPath={null}
        preview={null}
        availability={{ status: "ready" }}
      />
    );
  } else {
    viewer = (
      <section className="specs-workspace__document" aria-label="Spec document">
        <SpecTabs
          spec={selectedSpec}
          selectedFileKey={selectedFileKey}
          onSelectFile={fn()}
        />
        <div className="specs-workspace__viewer">
          <MarkdownViewer
            state={documentState}
            selectedSpecLabel={selectedSpec?.label ?? null}
            selectedFileLabel={selectedFile?.label ?? null}
            comments={sampleComments}
            activeCommentId={commentId("cmt_story_open_1")}
            onReload={fn()}
            onSelectComment={fn()}
          />
        </div>
      </section>
    );
  }

  const contextualRecentWorkspace =
    activeWorktreeName === null
      ? {
          path: "/workspace/plugin-manager",
          displayName: "plugin-manager",
          kind: "plugin-worktree" as const,
          lastOpenedAt: "2026-05-05T00:00:00.000Z",
        }
      : {
          path: workspaceStatusPath ?? worktreeWorkspacePath,
          displayName: activeWorktreeName,
          kind: "plugin-worktree" as const,
          lastOpenedAt: "2026-05-05T00:00:00.000Z",
        };

  return {
    leftOpen: true,
    leftHeader: null,
    pathbar: (
      <ThemeProvider>
        <WorkspaceToolbar
          workspacePath={workspaceStatusPath}
          inputValue={workspaceInput}
          isLoading={isWorkspaceLoading}
          isBrowsing={false}
          errorMessage={workspaceErrorMessage ?? null}
          canRefresh={selectedSpec !== null && selectedFileKey !== null}
          onInputChange={fn()}
          onBrowse={fn()}
          onLoad={fn()}
          onRefresh={fn()}
          onReset={fn()}
        />
      </ThemeProvider>
    ),
    toolbar: (
      <ViewModeToolbar
        mode={viewMode}
        activeItemLabel={
          selectedSpec !== null && selectedFile !== null
            ? selectedSpec.label + " / " + selectedFile.fileName
            : "ファイル未選択"
        }
        onModeChange={fn()}
      />
    ),
    sidebar: (
      <div className="left-navigation-panel">
        <WorkspaceSidebarSection
          currentWorkspacePath={workspaceStatusPath}
          isOpen={true}
          isBusy={isWorkspaceLoading}
          recentWorkspaces={[
            {
              path: "/workspace/spec-board",
              displayName: "spec-board",
              kind: "plugin-workspace",
              lastOpenedAt: "2026-05-07T00:00:00.000Z",
            },
            {
              path: workspacePath,
              displayName: "pdfmod",
              kind: "plugin-workspace",
              lastOpenedAt: "2026-05-06T00:00:00.000Z",
            },
            contextualRecentWorkspace,
          ]}
          onBrowse={fn()}
          onToggleOpen={fn()}
          onOpenWorkspace={fn()}
          onRemoveWorkspace={fn()}
        />
        <StoryWorktreeTree activeWorktreeName={activeWorktreeName} />
      </div>
    ),
    tabs:
      viewMode === "specs" ? (
        <SpecTree
          state={treeState}
          selectedSpecId={selectedSpec?.id ?? null}
          archivingSpecId={archivingSpecId}
          isLoading={archivingSpecId !== null}
          onSelectSpec={fn()}
          onArchiveSpec={fn()}
          onReload={fn()}
        />
      ) : (
        <ChangesNavigation
          items={[]}
          selectedId={null}
          availability={{
            status: "unavailable",
            reason: "data-source-not-connected",
          }}
          onSelect={fn()}
        />
      ),
    viewer,
    comments: (
      <CommentSidebar
        listState={{
          status: "ready",
          comments: sampleComments,
          error: null,
        }}
        operationState={{
          status: "idle",
          operation: null,
          commentId: null,
          error: null,
        }}
        activeCommentId={commentId("cmt_story_open_1")}
        onSelectComment={fn()}
        onResolveComment={fn()}
        onReopenComment={fn()}
        onDeleteComment={fn()}
        onUpdateComment={fn()}
        onReload={fn()}
      />
    ),
  };
}

/**
 * Displays representative worktree rows for full-shell Story states.
 *
 * @param props - Name of the worktree currently opened by the Story.
 * @returns Accessible static worktree tree with one current row.
 */
function StoryWorktreeTree({
  activeWorktreeName,
}: Readonly<{ activeWorktreeName: string | null }>): ReactElement {
  const selectedWorktreeName = activeWorktreeName ?? "root";

  return (
    <section className="story-worktree-tree" aria-label="Worktrees">
      <input aria-label="Filter worktrees" placeholder="Filter worktrees..." />
      <div className="story-worktree-tree__header">
        <span>ROOT / WORKTREES {storyWorktrees.length}</span>
        <span aria-hidden="true">↻</span>
      </div>
      <WorktreeTree
        nodes={storyWorktrees.map((worktree) => ({
          kind: "worktree",
          id: worktree.name,
          label: worktree.icon + " " + worktree.name,
          count: { kind: "changed-file-count", value: worktree.changeCount },
        }))}
        selectedWorktreeId={selectedWorktreeName}
        emptyLabel="Worktree はありません"
        onSelectWorktree={fn()}
      />
    </section>
  );
}
