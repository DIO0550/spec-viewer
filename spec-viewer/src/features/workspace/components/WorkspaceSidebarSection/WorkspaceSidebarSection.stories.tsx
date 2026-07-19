import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import type { RecentWorkspace } from "@/shared/lib/recentWorkspaces";

import { WorkspaceSidebarSection } from ".";

const recentWorkspaces: readonly RecentWorkspace[] = [
  {
    path: "/workspace/spec-reviewer",
    displayName: "spec-reviewer",
    kind: "plugin-workspace",
    lastOpenedAt: "2026-05-07T10:00:00Z",
  },
  {
    path: "/workspace/spec-reviewer-worktree",
    displayName: "spec-reviewer-worktree",
    kind: "plugin-worktree",
    lastOpenedAt: "2026-05-06T10:00:00Z",
  },
];

const meta: Meta<typeof WorkspaceSidebarSection> = {
  component: WorkspaceSidebarSection,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    currentWorkspacePath: "/workspace/spec-reviewer",
    isOpen: true,
    isBusy: false,
    recentWorkspaces,
    onBrowse: fn(),
    onToggleOpen: fn(),
    onOpenWorkspace: fn(),
    onRemoveWorkspace: fn(),
  },
  argTypes: {
    recentWorkspaces: { control: false },
    onBrowse: { control: false },
    onToggleOpen: { control: false },
    onOpenWorkspace: { control: false },
    onRemoveWorkspace: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof WorkspaceSidebarSection>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    isBusy: true,
  },
};

export const EdgeCases: Story = {
  args: {
    currentWorkspacePath: null,
    isOpen: false,
    recentWorkspaces: [],
  },
};
