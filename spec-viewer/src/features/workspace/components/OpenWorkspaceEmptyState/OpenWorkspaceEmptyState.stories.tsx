import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import type { RecentWorkspace } from "@/utils/recentWorkspaces";

import { OpenWorkspaceEmptyState } from ".";

const recentWorkspaces: readonly RecentWorkspace[] = [
  {
    path: "/workspace/spec-reviewer",
    displayName: "spec-reviewer",
    kind: "plugin-workspace",
    lastOpenedAt: "2026-05-07T10:00:00Z",
  },
  {
    path: "/workspace/another-project",
    displayName: "another-project",
    kind: "plugin-worktree",
    lastOpenedAt: "2026-05-06T10:00:00Z",
  },
];

const meta: Meta<typeof OpenWorkspaceEmptyState> = {
  component: OpenWorkspaceEmptyState,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: "80vh" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    isOpening: false,
    recentWorkspaces: [],
    onOpenWorkspace: fn(),
    onOpenRecentWorkspace: fn(),
    onRemoveRecentWorkspace: fn(),
  },
  argTypes: {
    recentWorkspaces: { control: false },
    onOpenWorkspace: { control: false },
    onOpenRecentWorkspace: { control: false },
    onRemoveRecentWorkspace: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof OpenWorkspaceEmptyState>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    recentWorkspaces,
  },
};

export const EdgeCases: Story = {
  args: {
    isOpening: true,
    recentWorkspaces,
  },
};
