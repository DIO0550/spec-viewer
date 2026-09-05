import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommentId } from "@/features/comments/domain/commentId";
import { CommentListState } from "@/features/comments/domain/commentListState";
import {
  CommentOperationFailedState,
  CommentOperationIdleState,
} from "@/features/comments/domain/commentOperation";
import type { Comment } from "@/features/comments/domain/comment";
import { createTextHash } from "@/features/comments/lib/comment-anchor-draft";
import type { CommentExportState } from ".";

import { CommentSidebar } from ".";

const openCommentId = CommentId.fromString("sidebar-open-comment");
const resolvedCommentId = CommentId.fromString("sidebar-resolved-comment");

const openComment: Comment = {
  id: openCommentId,
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 1,
    textHash: createTextHash("Keep the selected requirement observable."),
    textSnippet: "Keep the selected requirement observable.",
    charRange: { start: 0, end: 42 },
  },
  body: "Please add an observable acceptance signal.",
  status: "open",
  anchorResolution: null,
  createdAt: "2026-05-07T10:00:00Z",
  updatedAt: "2026-05-07T10:00:00Z",
};

const resolvedComment: Comment = {
  ...openComment,
  id: resolvedCommentId,
  body: "The acceptance signal is now covered by the test plan.",
  status: "resolved",
};

const commentError = {
  feature: "comments" as const,
  code: "commentRepository" as const,
  message: "The comment store is unavailable.",
  cause: {
    command: "list_comments" as const,
    code: "commentRepository" as const,
    message: "The comment store is unavailable.",
    raw: "story fixture",
  },
};

const successfulExport: CommentExportState = {
  status: "success",
  operation: "file",
  message: "Comments exported to review-comments.md",
};

const meta: Meta<typeof CommentSidebar> = {
  component: CommentSidebar,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 560, width: 390 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    listState: CommentListState.loaded([openComment, resolvedComment]),
    operationState: CommentOperationIdleState.create(),
    activeCommentId: openCommentId,
    anchorDisplayStates: [
      { commentId: openCommentId, status: "exact" },
      { commentId: resolvedCommentId, status: "fuzzy" },
    ],
    onSelectComment: fn(),
    onResolveComment: fn(),
    onReopenComment: fn(),
    onDeleteComment: fn(),
    onUpdateComment: fn(),
    onReload: fn(),
    onExportComments: fn(),
    onCopyLlmPrompt: fn(),
    onCopyMcpFeedback: fn(),
  },
  argTypes: {
    listState: { control: false },
    operationState: { control: false },
    activeCommentId: { control: false },
    anchorDisplayStates: { control: false },
    exportState: { control: false },
    onSelectComment: { control: false },
    onResolveComment: { control: false },
    onReopenComment: { control: false },
    onDeleteComment: { control: false },
    onUpdateComment: { control: false },
    onReload: { control: false },
    onExportComments: { control: false },
    onCopyLlmPrompt: { control: false },
    onCopyMcpFeedback: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof CommentSidebar>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    exportState: successfulExport,
    operationState: CommentOperationFailedState.create(
      "update",
      openCommentId,
      commentError,
    ),
  },
};

export const Loading: Story = {
  args: {
    listState: CommentListState.loading(),
    activeCommentId: null,
    anchorDisplayStates: [],
  },
};

export const Empty: Story = {
  args: {
    listState: CommentListState.loaded([]),
    activeCommentId: null,
    anchorDisplayStates: [],
  },
};

export const Error: Story = {
  args: {
    listState: CommentListState.error(commentError),
    activeCommentId: null,
    anchorDisplayStates: [],
  },
};

export const EdgeCases: Story = {
  args: {
    listState: CommentListState.loaded([
      {
        ...openComment,
        body: "A very long comment body remains searchable and readable. ".repeat(
          10,
        ),
      },
    ]),
    activeCommentId: openCommentId,
    anchorDisplayStates: [{ commentId: openCommentId, status: "orphaned" }],
  },
};
