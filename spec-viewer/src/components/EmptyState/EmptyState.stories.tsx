import type { Meta, StoryObj } from "@storybook/react-vite";

import { EmptyState } from ".";

const meta: Meta<typeof EmptyState> = {
  component: EmptyState,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 240 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Select a document",
    description: "Choose a file from the tree to start reviewing.",
    variant: "panel",
  },
  argTypes: {
    action: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    variant: "inline",
    /** Call-to-action button rendered alongside the empty state message. */
    action: (
      <button className="button button--primary" type="button">
        Open workspace
      </button>
    ),
  },
};

export const EdgeCases: Story = {
  args: {
    title: "Nothing here yet",
    description: undefined,
    action: undefined,
  },
};
