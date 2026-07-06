import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { DocumentSearchControl } from "./index";

const meta: Meta<typeof DocumentSearchControl> = {
  component: DocumentSearchControl,
  decorators: [
    (Story) => (
      <div className="markdown-viewer__actions" style={{ padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    query: "",
    statusText: "0件",
    hasMatches: false,
    disabled: false,
    onQueryChange: fn(),
    onPrevious: fn(),
    onNext: fn(),
    onClear: fn(),
  },
  argTypes: {
    onQueryChange: { control: false },
    onPrevious: { control: false },
    onNext: { control: false },
    onClear: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof DocumentSearchControl>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    query: "schema",
    statusText: "2/8",
    hasMatches: true,
    disabled: false,
  },
};

export const EdgeCases: Story = {
  args: {
    query: "missing phrase",
    statusText: "0件",
    hasMatches: false,
    disabled: true,
  },
};
