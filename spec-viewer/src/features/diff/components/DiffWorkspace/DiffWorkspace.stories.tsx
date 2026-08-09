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

export const SelectionRequired: Story = {
  args: {
    selectedPath: null,
    preview: null,
    availability: { status: "ready" },
    state: {
      status: "selectionRequired",
      message: "比較元のブランチを選択してください。",
      onRetry: () => undefined,
    },
  },
};

export const Binary: Story = {
  args: {
    selectedPath: "assets/logo.bin",
    preview: <p role="status">バイナリファイルのため差分を表示できません。</p>,
    availability: { status: "ready" },
    state: {
      status: "ready",
      selectedPath: "assets/logo.bin",
      preview: (
        <p role="status">バイナリファイルのため差分を表示できません。</p>
      ),
    },
  },
};

export const Deleted: Story = {
  args: {
    selectedPath: "src/removed.ts",
    preview: <p role="status">比較対象の片側が取得できません。</p>,
    availability: { status: "ready" },
    state: {
      status: "ready",
      selectedPath: "src/removed.ts",
      preview: <p role="status">比較対象の片側が取得できません。</p>,
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
export const InvalidOverride: Story = {
  args: {
    selectedPath: null,
    preview: null,
    availability: { status: "ready" },
    state: {
      status: "failed",
      message: "指定された比較元ブランチを解決できません。",
      onRetry: () => undefined,
    },
  },
};
export const Unavailable: Story = {
  args: {
    selectedPath: null,
    preview: null,
    availability: { status: "unavailable", reason: "contract-pending" },
  },
};
export const DetailLoading: Story = {
  args: {
    selectedPath: "src/file.ts",
    preview: null,
    availability: { status: "ready" },
    state: { status: "loading" },
  },
};
