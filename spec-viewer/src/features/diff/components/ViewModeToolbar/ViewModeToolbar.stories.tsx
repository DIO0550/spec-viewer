import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ViewModeToolbar } from ".";

const meta = {
  component: ViewModeToolbar,
  args: {
    mode: "specs",
    activeItemLabel: "Implementation",
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
} satisfies Meta<typeof ViewModeToolbar>;

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
    activeItemLabel:
      "とても長いファイル名でもツールバー全体が崩れないことを確認するための仕様書.md",
  },
};

export const Ready: Story = {
  args: { diffAvailability: { status: "ready" } },
};

export const NonRepository: Story = {
  args: {
    diffAvailability: {
      status: "unavailable",
      reason: "Git repositoryではありません",
    },
  },
};

export const Loading: Story = {
  args: {
    diffAvailability: {
      status: "unavailable",
      reason: "Diff情報を読み込んでいます",
    },
  },
};
