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

export const Default: Story = {
  args: {
    selectedPath: "src/scorer.ts",
    preview: <pre>{"example diff"}</pre>,
    availability: { status: "ready" },
  },
};

export const Unchanged: Story = {
  args: {
    selectedPath: null,
    preview: null,
    availability: { status: "ready" },
    state: { status: "unchanged" },
  },
};

export const Loading: Story = {
  args: {
    selectedPath: null,
    preview: null,
    availability: { status: "ready" },
    state: { status: "loading" },
  },
};

export const Failed: Story = {
  args: {
    selectedPath: null,
    preview: null,
    availability: { status: "ready" },
    state: {
      status: "failed",
      message: "差分の取得に失敗しました",
      /** No-op story stub; the story does not model a diff retry. */
      onRetry: () => undefined,
    },
  },
};

export const Ready: Story = {
  args: {
    selectedPath: "tasks.md",
    preview: <pre>{"example diff"}</pre>,
    availability: { status: "ready" },
    state: {
      status: "ready",
      selectedPath: "tasks.md",
      preview: <pre>{"example diff"}</pre>,
    },
  },
};
