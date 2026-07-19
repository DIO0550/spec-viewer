import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CommentPopover } from ".";

const meta: Meta<typeof CommentPopover> = {
  component: CommentPopover,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 240, padding: 24, position: "relative" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    children: (
      <div style={{ display: "grid", gap: 8 }}>
        <strong>Comment details</strong>
        <p style={{ margin: 0 }}>
          Review notes stay close to the selected text.
        </p>
        <button type="button">Close</button>
      </div>
    ),
    className: "comment-popover",
    onClose: fn(),
  },
  argTypes: {
    children: { control: false },
    onClose: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof CommentPopover>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    id: "comment-popover-example",
    "aria-label": "Comment actions",
    isDismissDisabled: true,
    children: (
      <div style={{ display: "grid", gap: 8 }}>
        <strong>Dismissal disabled</strong>
        <p style={{ margin: 0 }}>
          The parent keeps this popover open while saving.
        </p>
      </div>
    ),
  },
};

export const EdgeCases: Story = {
  args: {
    children: <span>Short content</span>,
  },
};
