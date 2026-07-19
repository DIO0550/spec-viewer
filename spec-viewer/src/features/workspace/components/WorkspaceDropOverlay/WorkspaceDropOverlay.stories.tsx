import type { Meta, StoryObj } from "@storybook/react-vite";

import { WorkspaceDropOverlay } from ".";

const meta: Meta<typeof WorkspaceDropOverlay> = {
  component: WorkspaceDropOverlay,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: "70vh", position: "relative" }}>
        <p style={{ padding: 24 }}>
          Drag a workspace folder over this surface.
        </p>
        <Story />
      </div>
    ),
  ],
  args: {
    isVisible: true,
  },
};

export default meta;

type Story = StoryObj<typeof WorkspaceDropOverlay>;

export const Default: Story = {};

export const Hidden: Story = {
  args: {
    isVisible: false,
  },
};

export const EdgeCases: Story = {
  args: {
    isVisible: true,
  },
};
