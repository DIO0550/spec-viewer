import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommentId } from "@/features/comments/types/comment";
import { UserReviewPanel } from "@/features/review-runs/components/UserReviewPanel";

const meta = {
  component: UserReviewPanel,
  args: {
    targetScope: "file",
    workspaceMode: "currentWorkspace",
    openCommentCount: 2,
    listState: {
      status: "ready",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
      active: [
        {
          id: "2026-05-06T120000Z-file-tasks-abcdef12",
          status: "active",
          target: {
            scope: "file",
            specId: "auth",
            fileKey: "tasks",
          },
          workspace: {
            mode: "currentWorkspace",
            workspacePath: "/workspace/spec-reviewer",
          },
          specFolderPath:
            "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
          folderPath:
            "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
          sourceFiles: [
            {
              specId: "auth",
              fileKey: "tasks",
              relativePath: ".plugin-workspace/.specs/auth/tasks.md",
            },
          ],
          commentCount: 2,
          createdAt: "2026-05-06T12:00:00Z",
          archivedAt: null,
          summary: null,
          warnings: [],
        },
      ],
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
    onWorkspaceModeChange: fn(),
    onCreateUserReview: fn(),
    onArchiveUserReview: fn(),
    onRefreshUserReviews: fn(),
    onCopyPath: fn(async () => undefined),
  },
  argTypes: {
    onTargetScopeChange: { control: false },
    onWorkspaceModeChange: { control: false },
    onCreateUserReview: { control: false },
    onArchiveUserReview: { control: false },
    onRefreshUserReviews: { control: false },
    onCopyPath: { control: false },
  },
} satisfies Meta<typeof UserReviewPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    openCommentCount: 0,
    listState: {
      status: "empty",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
      active: [],
      archived: [],
      problems: [],
      error: null,
    },
  },
};

export const Error: Story = {
  args: {
    createState: {
      status: "error",
      payload: { commentIds: [], workspaceMode: "currentWorkspace" },
      error: {
        code: "userReviewExport",
        message: "source files have uncommitted changes",
        raw: {},
      },
    },
  },
};

export const Loading: Story = {
  args: {
    listState: {
      status: "loading",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
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
        workspaceMode: "currentWorkspace",
      },
    },
  },
};

export const Archiving: Story = {
  args: {
    listState: {
      status: "ready",
      target: {
        scope: "file",
        specId: "auth",
        fileKey: "tasks",
      },
      active: [
        {
          id: "2026-05-06T120000Z-file-tasks-abcdef12",
          status: "completed",
          target: {
            scope: "file",
            specId: "auth",
            fileKey: "tasks",
          },
          workspace: {
            mode: "currentWorkspace",
            workspacePath: "/workspace/spec-reviewer",
          },
          specFolderPath:
            "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
          folderPath:
            "/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/2026-05-06T120000Z-file-tasks-abcdef12",
          sourceFiles: [
            {
              specId: "auth",
              fileKey: "tasks",
              relativePath: ".plugin-workspace/.specs/auth/tasks.md",
            },
          ],
          commentCount: 2,
          createdAt: "2026-05-06T12:00:00Z",
          archivedAt: null,
          summary: "対応完了",
          warnings: [],
        },
      ],
      archived: [],
      problems: [],
      error: null,
    },
    archiveState: {
      status: "saving",
      payload: {
        userReviewId: "2026-05-06T120000Z-file-tasks-abcdef12",
      },
    },
  },
};
