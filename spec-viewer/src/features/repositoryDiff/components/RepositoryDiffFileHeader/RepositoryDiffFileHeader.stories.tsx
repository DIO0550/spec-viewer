import type { Meta, StoryObj } from "@storybook/react-vite";

import { RepositoryDiffFileHeader } from "@/features/repositoryDiff/components/RepositoryDiffFileHeader";

const meta = {
  component: RepositoryDiffFileHeader,
  args: {
    path: "src/main.ts",
    change: "modified",
    baseIdentifier: "abcdef0",
    currentIdentifier: "rs1_12345678",
    summary: { additions: 12, deletions: 3 },
  },
} satisfies Meta<typeof RepositoryDiffFileHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllProps: Story = { args: { change: "renamed" } };
export const EdgeCases: Story = {
  args: {
    path: "src/features/repositoryDiff/components/RepositoryDiffFileHeader/a-very-long-file-name.tsx",
    change: null,
    summary: null,
  },
};
