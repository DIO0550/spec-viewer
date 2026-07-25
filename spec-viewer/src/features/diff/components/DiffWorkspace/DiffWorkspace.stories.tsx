import type { Meta, StoryObj } from "@storybook/react-vite";

import { DiffWorkspace } from ".";

const meta = {
  title: "Features/Diff/DiffWorkspace",
  component: DiffWorkspace,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", minHeight: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiffWorkspace>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
