import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommentId } from "@/features/comments/types/comment";
import { UserReviewPanel } from "@/features/review-runs/components/UserReviewPanel";
import type { ActiveUserReview } from "@/features/review-runs/domain/userReview";

const activeReview: ActiveUserReview = {
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "urv_0123456789abcdef0123456789abcdef",
  status: "active",
  target: {
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  },
  recordLocator: "urv_0123456789abcdef0123456789abcdef.json",
  commentCount: 2,
  createdAt: "2026-07-12T10:00:00Z",
  updatedAt: "2026-07-12T10:00:00Z",
  archivedAt: null,
};

const meta = {
  component: UserReviewPanel,
  args: {
    targetScope: "file",
    openCommentCount: 2,
    canCreateUserReview: true,
    listState: {
      status: "ready",
      target: activeReview.target,
      active: [activeReview],
      archived: [],
      problems: [],
      error: null,
    },
    createState: {
      status: "idle",
    },
    archiveState: {
      status: "idle",
    },
    onTargetScopeChange: fn(),
    onCreateUserReview: fn(),
    onArchiveUserReview: fn(),
    onRefreshUserReviews: fn(),
  },
  argTypes: {
    onTargetScopeChange: { control: false },
    onCreateUserReview: { control: false },
    onArchiveUserReview: { control: false },
    onRefreshUserReviews: { control: false },
  },
} satisfies Meta<typeof UserReviewPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    targetScope: "spec",
    openCommentCount: 12,
  },
};

export const Empty: Story = {
  args: {
    openCommentCount: 0,
    listState: {
      status: "empty",
      target: activeReview.target,
      active: [],
      archived: [],
      problems: [],
      error: null,
    },
  },
};

export const CreateError: Story = {
  args: {
    createState: {
      status: "error",
      payload: { commentIds: [CommentId.fromString("cmt_1")] },
      error: {
        code: "userReviewExport",
        message: "failed to write user review record",
        raw: {},
      },
    },
  },
};

export const Loading: Story = {
  args: {
    listState: {
      status: "loading",
      target: activeReview.target,
      active: [],
      archived: [],
      problems: [],
      error: null,
    },
  },
};

export const Creating: Story = {
  args: {
    createState: {
      status: "saving",
      payload: {
        commentIds: [CommentId.fromString("cmt_1")],
      },
    },
  },
};

export const Archiving: Story = {
  args: {
    archiveState: {
      status: "saving",
      payload: {
        userReviewId: activeReview.id,
      },
    },
  },
};

export const Problems: Story = {
  args: {
    listState: {
      status: "empty",
      target: activeReview.target,
      active: [],
      archived: [],
      problems: [
        {
          locator: "legacy-review-folder",
          kind: "legacyRecord",
          message: "legacy folder bundle",
        },
        {
          locator: "future-review.json",
          kind: "unsupportedRecordVersion",
          message: "schema version 2 is not supported",
        },
      ],
      error: null,
    },
  },
};
