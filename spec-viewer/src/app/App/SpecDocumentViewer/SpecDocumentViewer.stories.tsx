import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  CommentId,
  CommentOperationIdleState,
  type Comment,
} from "@/features/comments";
import { type SpecArtifact, SpecBundleState } from "@/features/specs";
import { SpecDocumentViewer, type SpecDocumentViewerProps } from ".";

const paragraph = "A commentable paragraph for the composition boundary.";
const standardArtifact: SpecArtifact = {
  identity: { kind: "standard", fileKey: "impl" },
  fileKey: "impl",
  fileName: "implementation-plan.md",
  label: "Implementation Plan",
  format: "markdown",
  progress: "inProgress",
  path: ".plugin-workspace/.specs/091/implementation-plan.md",
  contents: `# App composition\n\n${paragraph}`,
  blocks: [
    {
      blockType: "heading",
      blockIndex: 0,
      textHash: "sha256:heading",
      textSnippet: "App composition",
      sourceRange: null,
    },
    {
      blockType: "paragraph",
      blockIndex: 1,
      textHash: "sha256:paragraph",
      textSnippet: paragraph,
      sourceRange: null,
    },
  ],
  error: null,
};

const directArtifact: SpecArtifact = {
  ...standardArtifact,
  identity: { kind: "directMarkdown", fileName: "Notes.md" },
  fileKey: null,
  fileName: "Notes.md",
  label: "Notes",
  path: ".plugin-workspace/.specs/091/Notes.md",
};

const comment: Comment = {
  id: CommentId.fromString("story-comment"),
  anchor: {
    fileKey: "impl",
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:paragraph",
    textSnippet: paragraph,
    charRange: { start: 2, end: 13 },
  },
  body: "The App boundary owns this comment integration.",
  status: "open",
  anchorResolution: null,
  createdAt: "2026-09-03T00:00:00Z",
  updatedAt: "2026-09-03T00:00:00Z",
};

function createStoryArgs({
  artifact,
  comments = [],
}: Readonly<{
  artifact: SpecArtifact;
  comments?: readonly Comment[];
}>): SpecDocumentViewerProps {
  return {
    showOpenWorkspacePrompt: false,
    openWorkspace: {
      isOpening: false,
      recentWorkspaces: [],
      onOpenWorkspace: fn(),
      onOpenRecentWorkspace: fn(),
      onRemoveRecentWorkspace: fn(),
    },
    viewer: {
      bundleState: SpecBundleState.loaded({
        specId: "091",
        progress: "inProgress",
        artifacts: [artifact],
      }),
      artifact,
      workspacePath: "/workspace/spec-viewer",
      selectedSpecLabel: "Issue 108",
      onReload: fn(),
      onFirstReadable: fn(),
    },
    comments: {
      enabled: true,
      layer: {
        comments,
        activeCommentId: comments[0]?.id ?? null,
        addState: {
          isSaving: false,
          errorMessage: null,
          isScopeReady: true,
        },
        editState: {
          isSaving: false,
          operationState: CommentOperationIdleState.create(),
        },
        actions: {
          add: fn().mockResolvedValue(true),
          update: fn().mockResolvedValue(true),
          resolve: fn().mockResolvedValue(true),
          delete: fn().mockResolvedValue(true),
          select: fn(),
          reportAnchorDisplayStates: fn(),
        },
      },
    },
  };
}

const meta = {
  component: SpecDocumentViewer,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="specs-workspace__viewer" style={{ minHeight: 640 }}>
        <Story />
      </div>
    ),
  ],
  args: createStoryArgs({ artifact: directArtifact }),
} satisfies Meta<typeof SpecDocumentViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DirectArtifact: Story = {};

export const CommentIntegration: Story = {
  args: createStoryArgs({ artifact: standardArtifact, comments: [comment] }),
};

export const StaleAnchor: Story = {
  args: createStoryArgs({
    artifact: standardArtifact,
    comments: [
      {
        ...comment,
        id: CommentId.fromString("story-stale-comment"),
        anchor: { ...comment.anchor, textHash: "sha256:old-paragraph" },
      },
    ],
  }),
};

export const AddDraft: Story = {
  args: createStoryArgs({ artifact: standardArtifact, comments: [comment] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getAllByRole("button", { name: "コメント追加" })[1],
    );
    await expect(canvas.getByRole("dialog")).toBeInTheDocument();
  },
};

export const EditDraft: Story = {
  args: createStoryArgs({ artifact: standardArtifact, comments: [comment] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /コメントを開く/ }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: /コメント編集を開く/ }),
    );
    await expect(canvas.getByRole("dialog")).toBeInTheDocument();
  },
};
