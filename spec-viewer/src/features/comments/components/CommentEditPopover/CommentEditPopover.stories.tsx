import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { CommentEditPopover } from "@/features/comments/components/CommentEditPopover";
import {
  CommentOperationFailedState,
  CommentOperationIdleState,
  CommentOperationSavingState,
} from "@/features/comments/domain/commentOperation";
import type { Comment } from "@/features/comments/types/comment";
import { CommentId } from "@/features/comments/types/comment";

const defaultCommentId = CommentId.fromString("cmt_story_edit");

const defaultComment: Comment = {
  id: defaultCommentId,
  anchor: {
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 2,
    textHash: "fnv1a:12345678",
    textSnippet: "selected requirement text",
    charRange: {
      start: 4,
      end: 29,
    },
  },
  body: "既存コメントの本文です。",
  status: "open",
  resolved: false,
  anchorResolution: null,
  createdAt: "2026-05-05T10:00:00Z",
  updatedAt: "2026-05-05T10:00:00Z",
};

const defaultDraft = {
  comment: defaultComment,
};

const meta: Meta<typeof CommentEditPopover> = {
  component: CommentEditPopover,
  args: {
    draft: defaultDraft,
    style: {
      top: 24,
      left: 24,
    },
    isSaving: false,
    operationState: CommentOperationIdleState.create(),
    onSubmit: fn(),
    onResolveComment: fn(),
    onReopenComment: fn(),
    onDeleteComment: fn(),
    onCancel: fn(),
  },
  argTypes: {
    draft: { control: false },
    style: { control: false },
    operationState: { control: false },
    onSubmit: { control: false },
    onResolveComment: { control: false },
    onReopenComment: { control: false },
    onDeleteComment: { control: false },
    onCancel: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof CommentEditPopover>;

export const Default: Story = {};

export const Busy: Story = {
  args: {
    operationState: CommentOperationSavingState.create(
      "update",
      defaultCommentId,
    ),
  },
};

export const Error: Story = {
  args: {
    operationState: CommentOperationFailedState.create(
      "update",
      defaultCommentId,
      {
        feature: "comments",
        code: "unknown",
        message: "コメントを更新できませんでした。",
        cause: {
          command: "update_comment",
          code: "unknown",
          message: "コメントを更新できませんでした。",
          raw: null,
        },
      },
    ),
  },
};

export const DeleteConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "削除" }));
    await expect(canvas.getByRole("alert")).toBeInTheDocument();
  },
};

export const DeleteFailure: Story = {
  args: {
    operationState: CommentOperationFailedState.create(
      "delete",
      defaultCommentId,
      {
        feature: "comments",
        code: "unknown",
        message: "コメントを削除できませんでした。再試行してください。",
        cause: {
          command: "delete_comment",
          code: "unknown",
          message: "コメントを削除できませんでした。再試行してください。",
          raw: null,
        },
      },
    ),
  },
};
