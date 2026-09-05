import type { Meta, StoryObj } from "@storybook/react-vite";
import { RepositoryDiffSummary } from ".";

const meta = {
  component: RepositoryDiffSummary,
  args: {
    summary: {
      filter: "changed",
      totalPaths: 4,
      changedPaths: 4,
      statusCounts: { added: 1, modified: 2, deleted: 1 },
      ignoredDirectoryCount: 2,
    },
  },
} satisfies Meta<typeof RepositoryDiffSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    summary: {
      filter: "all",
      totalPaths: 128,
      changedPaths: 7,
      statusCounts: {
        added: 1,
        modified: 2,
        deleted: 1,
        renamed: 1,
        copied: 1,
        typeChanged: 1,
        untracked: 1,
      },
      ignoredDirectoryCount: 5,
    },
  },
};

export const Empty: Story = {
  args: {
    summary: {
      filter: "changed",
      totalPaths: 0,
      changedPaths: 0,
      statusCounts: {},
      ignoredDirectoryCount: 0,
    },
  },
};
