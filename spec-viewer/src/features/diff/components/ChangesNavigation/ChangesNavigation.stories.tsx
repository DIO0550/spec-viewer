import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ChangesNavigation } from ".";

const meta = {
  title: "Features/Diff/ChangesNavigation",
  component: ChangesNavigation,
  args: {
    items: [],
    selectedId: null,
    availability: { status: "ready" },
    onSelect: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof ChangesNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyMixed: Story = {
  args: {
    selectedId: "impl",
    items: [
      { id: "impl", path: "079/implementation-plan.md", change: "modified" },
      { id: "tasks", path: "079/tasks.md", change: "untracked" },
      { id: "requirements", path: "079/requirements.md", change: "deleted" },
    ],
  },
};

export const Empty: Story = {};

export const Loading: Story = {
  args: { availability: { status: "loading" } },
};

export const Failed: Story = {
  args: {
    availability: { status: "failed", message: "変更一覧の取得に失敗しました" },
  },
};
