import * as TestValues from "@/shared/testing/validatedValueObjects";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, type ReactNode, useState } from "react";
import { fn } from "storybook/test";
import {
  type Comment,
  CommentSidebar,
  createTextHash,
} from "@/features/comments";
import { ThemeProvider } from "@/features/preferences";
import type {
  SpecDocument,
  SpecDocumentState,
  SpecFileKey,
  SpecNode,
  SpecTreeData as SpecTreeShape,
  SpecTreeState,
} from "@/features/specs";
import {
  MarkdownViewer,
  SpecTabs,
  SpecTree,
  toSpecFeatureError,
} from "@/features/specs";
import {
  WorkspaceSidebarSection,
  WorkspaceToolbar,
} from "@/features/workspace";
import { WorkspaceLayout } from "@/shared/ui/WorkspaceLayout";

const workspacePath = "/workspace/spec-reviewer";
const commentId = TestValues.commentId;

const sampleSpec: SpecNode = {
  id: TestValues.specId("phase-1-viewer"),
  label: "Phase 1 Viewer",
  files: [
    {
      key: "impl",
      label: "Implementation",
      fileName: "implementation-plan.md",
      status: "missing",
    },
    {
      key: "tasks",
      label: "Tasks",
      fileName: "tasks.md",
      status: "present",
    },
    {
      key: "tech-reference",
      label: "Tech Reference",
      fileName: "tech-reference.html",
      status: "missing",
      format: "html",
    },
    {
      key: "test-cases",
      label: "Test Cases",
      fileName: "test-cases.html",
      status: "missing",
      format: "html",
    },
    {
      key: "design",
      label: "Design",
      fileName: "design.md",
      status: "present",
    },
  ],
  children: [
    {
      id: TestValues.specId("phase-1-comments"),
      label: "Phase 1 Comments",
      files: [
        {
          key: "requirements",
          label: "Requirements",
          fileName: "requirements.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const sampleTree: SpecTreeShape = {
  specs: [sampleSpec],
};

const sampleDocument: SpecDocument = {
  key: "tasks",
  path: "/workspace/spec-reviewer/docs/plans/tasks/phase-1-viewer/p1-13-layout-components.md",
  contents: [
    "# P1.14 Markdown Rendering",
    "",
    "> Render review planning documents with anchors ready for comments.",
    "",
    "## Acceptance",
    "",
    "- [x] Headings and lists",
    "- [x] Fenced code blocks",
    "- [ ] Comment behavior follows in P1.15",
    "",
    "```ts",
    'const blockType = "heading";',
    "```",
    "",
    "| Element | Status |",
    "| --- | --- |",
    "| GFM table | Ready |",
    "| External link | [Docs](https://example.com/docs) |",
  ].join("\n"),
  missing: false,
  blocks: [],
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
  fileKey: "tasks",
  document: sampleDocument,
  error: null,
};

const sampleComments: readonly Comment[] = [
  {
    id: commentId("cmt_story_open"),
    anchor: {
      fileKey: "tasks",
      blockType: "list_item",
      blockIndex: 5,
      textHash: createTextHash("Comment behavior follows in P1.15"),
      textSnippet: "Comment behavior follows in P1.15",
      charRange: {
        start: 0,
        end: 34,
      },
    },
    body: "Check whether this note should move to Phase 2.",
    status: "open",
    resolved: false,
    createdAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
    updatedAt: TestValues.isoDateTime("2026-05-05T10:15:00Z"),
  },
  {
    id: commentId("cmt_story_resolved"),
    anchor: {
      fileKey: "tasks",
      blockType: "heading",
      blockIndex: 0,
      textHash: createTextHash("P1.14 Markdown Rendering"),
      textSnippet: "P1.14 Markdown Rendering",
      charRange: {
        start: 0,
        end: 25,
      },
    },
    body: "Rendering checklist is already reflected in the plan.",
    status: "resolved",
    resolved: true,
    createdAt: TestValues.isoDateTime("2026-05-05T11:00:00Z"),
    updatedAt: TestValues.isoDateTime("2026-05-05T11:30:00Z"),
  },
];

type WorkspaceLayoutStoryProps = Readonly<{
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
  const [storyLeftWidth, setStoryLeftWidth] = useState(leftWidth ?? 268);
  const [storyCommentsOpen, setStoryCommentsOpen] = useState(
    commentsOpen ?? true,
  );
  const [storyCommentsWidth, setStoryCommentsWidth] = useState(
    commentsWidth ?? 360,
  );

  return (
    <WorkspaceLayout.Root
      leftNavigation={{
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
      commentsSidebar={{
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

const meta = {
  component: WorkspaceLayoutStory,
  argTypes: {
    toolbar: { control: false },
    sidebar: { control: false },
    tabs: { control: false },
    viewer: { control: false },
    comments: { control: false },
  },
} satisfies Meta<typeof WorkspaceLayoutStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
  }),
};

export const Archiving: Story = {
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
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
      fileKey: "tasks",
      document: null,
      error: null,
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
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
      error: toSpecFeatureError("list", {
        code: "specTreeScan",
        message: "Spec directory could not be scanned.",
      }),
    },
    documentState: {
      status: "error",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "tasks",
      document: null,
      error: toSpecFeatureError("read", {
        code: "markdownRead",
        message: "Markdown file could not be read.",
      }),
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
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
  archivingSpecId?: SpecNode["id"] | null;
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
}: ShellArgsOptions): ComponentProps<typeof WorkspaceLayoutStory> {
  const selectedFile =
    selectedSpec?.files.find((file) => file.key === selectedFileKey) ?? null;

  return {
    leftOpen: true,
    leftHeader: (
      <div className="left-navigation-brand">
        <span className="left-navigation-brand__mark" aria-hidden="true">
          S
        </span>
        <span className="left-navigation-brand__copy">
          <strong>Spec Reviewer</strong>
          <span title={workspaceStatusPath ?? "ワークスペース未選択"}>
            {workspaceStatusPath ?? "ワークスペース未選択"}
          </span>
        </span>
      </div>
    ),
    toolbar: (
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
    sidebar: (
      <div className="left-navigation-panel">
        <WorkspaceSidebarSection
          currentWorkspacePath={workspaceStatusPath}
          isOpen={false}
          isBusy={isWorkspaceLoading}
          recentWorkspaces={[
            {
              path: workspacePath,
              displayName: "spec-reviewer",
              kind: "plugin-workspace",
              lastOpenedAt: "2026-05-06T00:00:00.000Z",
            },
            {
              path: "/workspace/legacy-spec-skill",
              displayName: "legacy-spec-skill",
              kind: "spec-skill",
              lastOpenedAt: "2026-05-05T00:00:00.000Z",
            },
          ]}
          onBrowse={fn()}
          onToggleOpen={fn()}
          onOpenWorkspace={fn()}
          onRemoveWorkspace={fn()}
        />
        <SpecTree
          state={treeState}
          selectedSpecId={selectedSpec?.id ?? null}
          archivingSpecId={archivingSpecId}
          isLoading={archivingSpecId !== null}
          onSelectSpec={fn()}
          onArchiveSpec={fn()}
          onReload={fn()}
        />
      </div>
    ),
    tabs: (
      <SpecTabs
        spec={selectedSpec}
        selectedFileKey={selectedFileKey}
        onSelectFile={fn()}
      />
    ),
    viewer: (
      <MarkdownViewer
        state={documentState}
        selectedSpecLabel={selectedSpec?.label ?? null}
        selectedFileLabel={selectedFile?.label ?? null}
        comments={sampleComments}
        activeCommentId={commentId("cmt_story_open")}
        onReload={fn()}
        onSelectComment={fn()}
      />
    ),
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
        activeCommentId={commentId("cmt_story_open")}
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
