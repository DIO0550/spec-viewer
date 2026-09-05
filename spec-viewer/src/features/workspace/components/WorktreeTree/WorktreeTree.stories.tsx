import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { WorktreeTreeNode } from "@/features/workspace/types/worktreeTreeNode";
import { WorktreeTree } from ".";

const specsNodes: readonly WorktreeTreeNode[] = [
  {
    kind: "category",
    id: "category:agents",
    label: "Agents",
    children: [
      {
        kind: "worktree",
        id: "agent-a",
        label: "agent-a",
        count: { kind: "spec-count", value: 2 },
      },
      {
        kind: "worktree",
        id: "agent-b",
        label: "agent-b",
        count: { kind: "spec-count", value: 0 },
      },
    ],
  },
];

const meta = {
  title: "Features/Workspace/WorktreeTree",
  component: WorktreeTree,
  args: {
    nodes: specsNodes,
    selectedWorktreeId: "agent-a",
    emptyLabel: "Worktree はありません",
    onSelectWorktree: fn(),
  },
} satisfies Meta<typeof WorktreeTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpecsHierarchy: Story = {
  /**
   * Confirms the selected worktree is marked current and that pressing
   * End then Enter selects the last visible row.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("treeitem", { name: /agent-a/ });
    await expect(selected).toHaveAttribute("aria-current", "page");
    await userEvent.keyboard("{End}{Enter}");
  },
};

export const DiffFlat: Story = {
  args: {
    nodes: [
      {
        kind: "worktree",
        id: "agent-a",
        label: "agent-a",
        count: { kind: "changed-file-count", value: 4 },
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    nodes: [],
    selectedWorktreeId: null,
  },
};

export const LongAndMany: Story = {
  args: {
    nodes: Array.from({ length: 40 }, (_, index) => ({
      kind: "worktree" as const,
      id: `worktree-${index}`,
      label: `very-long-worktree-name-${index}-for-overflow-check`,
      count: { kind: "changed-file-count" as const, value: index },
    })),
    selectedWorktreeId: "worktree-20",
  },
};
