import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommandErrorDisplay } from ".";

const error = {
  code: "workspaceDetection",
  message: "The selected directory is not a valid workspace.",
};

const meta: Meta<typeof CommandErrorDisplay> = {
  component: CommandErrorDisplay,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Workspace could not be opened",
    error,
  },
  argTypes: {
    error: { control: false },
    onAction: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof CommandErrorDisplay>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    actionLabel: "Try again",
    onAction: fn(),
  },
};

export const EdgeCases: Story = {
  args: {
    title: "Unknown failure",
    error: {
      code: "unknown",
      message: "No diagnostic details were returned.",
    },
    actionLabel: "Retry disabled",
    isActionDisabled: true,
    onAction: fn(),
  },
};
