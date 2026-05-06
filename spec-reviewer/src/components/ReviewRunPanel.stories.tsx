import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ReviewRunPanel } from "./ReviewRunPanel";

const meta = {
  component: ReviewRunPanel,
  args: {
    targetScope: "file",
    executionMode: "currentWorkspace",
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
          executionTarget: {
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
      reviewRun: null,
      error: null,
    },
    archiveState: {
      status: "idle",
      reviewRunId: null,
      reviewRun: null,
      error: null,
    },
    onTargetScopeChange: fn(),
    onExecutionModeChange: fn(),
    onCreateReviewRun: fn(),
    onArchiveReviewRun: fn(),
    onRefreshReviewRuns: fn(),
    onCopyPath: fn(async () => undefined),
  },
  argTypes: {
    onTargetScopeChange: { control: false },
    onExecutionModeChange: { control: false },
    onCreateReviewRun: { control: false },
    onArchiveReviewRun: { control: false },
    onRefreshReviewRuns: { control: false },
    onCopyPath: { control: false },
  },
} satisfies Meta<typeof ReviewRunPanel>;

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
      reviewRun: null,
      error: {
        code: "reviewRunExport",
        message: "source files have uncommitted changes",
        raw: {},
      },
    },
  },
};
