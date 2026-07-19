import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ErrorState } from ".";

const meta: Meta<typeof ErrorState> = {
  component: ErrorState,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Document unavailable",
    message: "The document could not be read from disk.",
  },
  argTypes: {
    onAction: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    actionLabel: "Reload document",
    onAction: fn(),
  },
};

export const EdgeCases: Story = {
  args: {
    title: "Unexpected error",
    message: "Please reopen the workspace and try again.",
  },
};
