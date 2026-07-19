import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommentId } from "@/features/comments/domain/commentId";
import { CommentOperationIdleState } from "@/features/comments/domain/commentOperation";
import type { Comment } from "@/features/comments/domain/comment";
import { createTextHash } from "@/features/comments/lib/comment-anchor-draft";

import { CommentThread } from ".";

const commentId = CommentId.fromString("thread-story-comment");
const selectedText = "The selected requirement remains actionable.";

const openComment: Comment = {
  id: commentId,
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 3,
    textHash: createTextHash(selectedText),
    textSnippet: selectedText,
    charRange: { start: 0, end: selectedText.length },
  },
  body: "Can we make this acceptance criterion measurable?",
  status: "open",
  anchorResolution: null,
  createdAt: "2026-05-07T10:00:00Z",
  updatedAt: "2026-05-07T10:00:00Z",
};

const meta: Meta<typeof CommentThread> = {
  component: CommentThread,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    comment: openComment,
    isActive: true,
    anchorDisplayStatus: "exact",
    operationState: CommentOperationIdleState.create(),
    onSelectComment: fn(),
    onUpdateComment: fn(),
    onResolveComment: fn(),
    onReopenComment: fn(),
    onDeleteComment: fn(),
  },
  argTypes: {
    comment: { control: false },
    operationState: { control: false },
    onSelectComment: { control: false },
    onUpdateComment: { control: false },
    onResolveComment: { control: false },
    onReopenComment: { control: false },
    onDeleteComment: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof CommentThread>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    comment: {
      ...openComment,
      id: CommentId.fromString("thread-story-resolved"),
      status: "resolved",
      body: "This resolved note demonstrates highlighted search text and a moved anchor.",
    },
    isActive: false,
    anchorDisplayStatus: "moved",
    searchQuery: "resolved",
  },
};

export const EdgeCases: Story = {
  args: {
    comment: {
      ...openComment,
      body: "A comment with a long body stays readable when the card has narrow space. ".repeat(
        4,
      ),
    },
    anchorDisplayStatus: "orphaned",
    searchQuery: "not-found",
  },
};
