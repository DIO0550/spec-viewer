import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommentId } from "@/features/comments/domain/commentId";
import { CommentListState } from "@/features/comments/domain/commentListState";
import { CommentOperationIdleState } from "@/features/comments/domain/commentOperation";
import { createTextHash } from "@/features/comments/lib/comment-anchor-draft";
import type { Comment } from "@/features/comments/domain/comment";
import type { CommentAnchorDisplayState } from "@/features/comments/types/comment";

import { SpecViewCommentSidebar } from ".";

const commentId = CommentId.fromString("comment-sidebar-story");
const workspaceRoot = "/workspace/spec-reviewer";
const comment: Comment = {
  id: commentId,
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 2,
    textHash: createTextHash(
      "The selected requirement should remain actionable.",
    ),
    textSnippet: "The selected requirement should remain actionable.",
    charRange: { start: 4, end: 46 },
  },
  body: "Confirm the acceptance wording before implementation.",
  status: "open",
  anchorResolution: null,
  createdAt: "2026-05-07T10:00:00Z",
  updatedAt: "2026-05-07T10:00:00Z",
};

const anchorDisplayStates: readonly CommentAnchorDisplayState[] = [
  { commentId, status: "exact" },
];

const meta: Meta<typeof SpecViewCommentSidebar> = {
  component: SpecViewCommentSidebar,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 520, width: 380 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    comments: [comment],
    resetKeys: {
      workspaceRoot,
      specId: "phase-1-viewer",
      fileKey: "tasks",
    },
    listState: CommentListState.loaded([comment]),
    operationState: CommentOperationIdleState.create(),
    activeCommentId: commentId,
    anchorDisplayStates,
    onSelectComment: fn(),
    onResolveComment: fn(),
    onReopenComment: fn(),
    onDeleteComment: fn(),
    onUpdateComment: fn(),
    onReloadComments: fn(),
  },
  argTypes: {
    comments: { control: false },
    resetKeys: { control: false },
    listState: { control: false },
    operationState: { control: false },
    anchorDisplayStates: { control: false },
    onSelectComment: { control: false },
    onResolveComment: { control: false },
    onReopenComment: { control: false },
    onDeleteComment: { control: false },
    onUpdateComment: { control: false },
    onReloadComments: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof SpecViewCommentSidebar>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    comments: [],
    listState: CommentListState.loaded([]),
    activeCommentId: null,
    anchorDisplayStates: [],
  },
};

export const Loading: Story = {
  args: {
    comments: [],
    listState: CommentListState.loading(),
    activeCommentId: null,
    anchorDisplayStates: [],
  },
};

export const EdgeCases: Story = {
  args: {
    comments: [comment],
    listState: CommentListState.error({
      feature: "comments",
      code: "commentRepository",
      message: "Comments could not be loaded from this workspace.",
      cause: {
        command: "list_comments",
        code: "commentRepository",
        message: "Comments could not be loaded from this workspace.",
        raw: "story fixture",
      },
    }),
    activeCommentId: null,
    anchorDisplayStates: [],
  },
};
