import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  DiffViewModeControls,
  type DiffViewModeControlsProps,
} from "@/features/diff/components/DiffViewModeControls";
import type { FileReviewViewMode } from "@/features/diff/domain/fileDiff";

function StatefulControls(
  props: DiffViewModeControlsProps,
): React.ReactElement {
  const [mode, setMode] = useState<FileReviewViewMode>(props.mode);
  return (
    <DiffViewModeControls
      {...props}
      mode={mode}
      onModeChange={(nextMode) => {
        setMode(nextMode);
        props.onModeChange(nextMode);
      }}
    />
  );
}

const meta = {
  component: DiffViewModeControls,
  render: (args) => <StatefulControls {...args} />,
  args: {
    mode: "unified",
    disabled: false,
    onModeChange: fn(),
  },
  argTypes: { onModeChange: { control: false } },
} satisfies Meta<typeof DiffViewModeControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllProps: Story = { args: { mode: "editor" } };
export const EdgeCases: Story = { args: { disabled: true } };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const unified = canvas.getByRole("radio", { name: "Unified" });
    unified.focus();
    await userEvent.keyboard("{End}");
    await expect(canvas.getByRole("radio", { name: "Editor" })).toHaveFocus();
  },
};
