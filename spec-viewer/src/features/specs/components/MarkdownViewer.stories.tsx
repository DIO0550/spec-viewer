import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import { createTextHash } from "@/features/comments/lib/comment-anchor-draft";
import type { Comment } from "@/features/comments/types/comment";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";

const workspacePath = "/workspace/spec-reviewer";
const markdownContents = [
  "# Selection reliability",
  "",
  "Users can select only this paragraph fragment without activating the highlight.",
  "",
  "- Copy should keep the exact selected range.",
  "- Comment creation should still work from the selection button.",
  "",
  "```ts",
  'const selectedText = "paragraph fragment";',
  "```",
].join("\n");

const readyState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: "selection-reliability",
  fileKey: "tasks",
  document: {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks/later-phases/p7-02-markdown-copy-selection-reliability.md",
    contents: markdownContents,
    missing: false,
    blocks: [],
  },
  error: null,
};

const highlightedParagraph =
  "Users can select only this paragraph fragment without activating the highlight.";

const comments: readonly Comment[] = [
  {
    id: "cmt_active_selection",
    anchor: {
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 1,
      textHash: createTextHash(highlightedParagraph),
      textSnippet: "paragraph fragment",
      charRange: {
        start: 27,
        end: 45,
      },
    },
    body: "Verify partial selection stays copyable inside this highlight.",
    status: "open",
    resolved: false,
    anchorResolution: null,
    createdAt: "2026-05-07T00:00:00Z",
    updatedAt: "2026-05-07T00:00:00Z",
  },
];

const commentCardComments: readonly Comment[] = [
  ...comments,
  {
    id: "cmt_resolved_card",
    anchor: {
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 1,
      textHash: createTextHash(highlightedParagraph),
      textSnippet: highlightedParagraph,
      charRange: {
        start: 0,
        end: highlightedParagraph.length,
      },
    },
    body: "Resolved note stays visible without making the paragraph feel busy.",
    status: "resolved",
    resolved: true,
    anchorResolution: null,
    createdAt: "2026-05-07T00:10:00Z",
    updatedAt: "2026-05-07T00:20:00Z",
  },
  {
    id: "cmt_code_card",
    anchor: {
      fileKey: "tasks",
      blockType: "code_block",
      blockIndex: 4,
      textHash: createTextHash('const selectedText = "paragraph fragment";'),
      textSnippet: "selectedText",
      charRange: {
        start: 6,
        end: 18,
      },
    },
    body: "Code block comments keep the gutter add button available.",
    status: "open",
    resolved: false,
    anchorResolution: null,
    createdAt: "2026-05-07T00:30:00Z",
    updatedAt: "2026-05-07T00:30:00Z",
  },
];

const meta: Meta<typeof MarkdownViewer> = {
  component: MarkdownViewer,
  args: {
    state: readyState,
    selectedSpecLabel: "Later Phases",
    selectedFileLabel: "Tasks",
    comments,
    activeCommentId: "cmt_active_selection",
    onReload: fn(),
    onSelectComment: fn(),
    onAddComment: fn(),
  },
  argTypes: {
    onReload: { control: false },
    onSelectComment: { control: false },
    onAddComment: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownViewer>;

export const HighlightedSelectionSurface: Story = {};

export const ExistingCommentCards: Story = {
  args: {
    comments: commentCardComments,
    activeCommentId: "cmt_active_selection",
  },
};
