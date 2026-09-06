import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ThemeProvider } from "@/features/preferences";

import { WorkspaceToolbar } from ".";

const meta: Meta<typeof WorkspaceToolbar> = {
  component: WorkspaceToolbar,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  args: {
    workspacePath: "/workspace/spec-reviewer",
    inputValue: "/workspace/spec-reviewer",
    isLoading: false,
    isBrowsing: false,
    errorMessage: null,
    canRefresh: true,
    onInputChange: fn(),
    onBrowse: fn(),
    onLoad: fn(),
    onRefresh: fn(),
    onReset: fn(),
  },
  argTypes: {
    onInputChange: { control: false },
    onBrowse: { control: false },
    onLoad: { control: false },
    onRefresh: { control: false },
    onReset: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof WorkspaceToolbar>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    isLoading: true,
    canRefresh: false,
  },
};

export const EdgeCases: Story = {
  args: {
    workspacePath: null,
    inputValue: "",
    errorMessage: "This directory is not a Spec Reviewer workspace.",
    canRefresh: false,
  },
};
