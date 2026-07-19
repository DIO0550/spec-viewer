import type { Meta, StoryObj } from "@storybook/react-vite";

import { LoadingSkeleton } from ".";

const meta: Meta<typeof LoadingSkeleton> = {
  component: LoadingSkeleton,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Loading comments",
    rows: [{ width: "long" }, { width: "full" }, { width: "medium" }],
  },
  argTypes: {
    rows: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof LoadingSkeleton>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    label: "Loading workspace files",
    className: "workspace-tree-loading",
    rows: [
      { width: "short" },
      { width: "medium" },
      { width: "long" },
      { width: "full" },
    ],
  },
};

export const EdgeCases: Story = {
  args: {
    label: "Nothing to load",
    rows: [],
  },
};
