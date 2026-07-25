import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ReviewModeToolbar } from ".";

const meta = {
  component: ReviewModeToolbar,
  args: {
    mode: "specs",
    fileLabel: "Implementation",
    onModeChange: fn(),
  },
  argTypes: {
    mode: {
      control: "inline-radio",
      options: ["specs", "diff"],
    },
    onModeChange: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReviewModeToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    mode: "diff",
  },
};

export const EdgeCases: Story = {
  args: {
    fileLabel:
      "とても長いファイル名でもツールバー全体が崩れないことを確認するための仕様書.md",
  },
};
