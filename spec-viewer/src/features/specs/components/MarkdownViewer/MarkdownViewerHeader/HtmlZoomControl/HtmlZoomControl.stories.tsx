import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { HtmlZoomControl } from "./index";

const meta: Meta<typeof HtmlZoomControl> = {
  component: HtmlZoomControl,
  decorators: [
    (Story) => (
      <div className="markdown-viewer__actions" style={{ padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    zoomPercentLabel: "100%",
    canDecrease: true,
    canIncrease: true,
    onDecrease: fn(),
    onIncrease: fn(),
  },
  argTypes: {
    onDecrease: { control: false },
    onIncrease: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof HtmlZoomControl>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    zoomPercentLabel: "110%",
    canDecrease: true,
    canIncrease: true,
  },
};

export const EdgeCases: Story = {
  args: {
    zoomPercentLabel: "50%",
    canDecrease: false,
    canIncrease: true,
  },
};
