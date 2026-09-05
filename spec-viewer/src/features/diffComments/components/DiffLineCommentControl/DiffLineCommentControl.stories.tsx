import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { DiffLineCommentControl } from "@/features/diffComments/components/DiffLineCommentControl";

const meta = {
  component: DiffLineCommentControl,
  args: {
    target: {
      key: "current:src/parser.ts:42",
      side: "current",
      sidePath: "src/parser.ts",
      line: 42,
    },
    comments: [],
    activeCommentId: null,
    onStartDraft: fn(),
    onSelectComment: fn(),
  },
  argTypes: {
    onStartDraft: { control: false },
    onSelectComment: { control: false },
  },
} satisfies Meta<typeof DiffLineCommentControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    comments: [
      {
        id: "comment-1",
        createdAt: "2026-08-11T10:00:00Z",
        label: "Open: first",
      },
    ],
    activeCommentId: "comment-1",
  },
};

export const EdgeCases: Story = {
  args: {
    comments: [
      {
        id: "comment-2",
        createdAt: "2026-08-11T11:00:00Z",
        label: "Resolved: second",
      },
      {
        id: "comment-1",
        createdAt: "2026-08-11T10:00:00Z",
        label: "Open: first",
      },
    ],
  },
};
