import type { Meta, StoryObj } from "@storybook/react-vite";

import { CurrentFileViewer } from "@/features/diff/components/CurrentFileViewer";
import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";

const meta = {
  component: CurrentFileViewer,
  parameters: { layout: "fullscreen" },
  args: {
    fileDiff: createDiffViewerFixture({
      newContent: "export const first = true;\nexport const second = false;",
    }),
  },
  argTypes: { fileDiff: { control: false } },
} satisfies Meta<typeof CurrentFileViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllProps: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      newContent: Array.from(
        { length: 100 },
        (_, index) => `export const line${index} = ${index};`,
      ).join("\n"),
    }),
  },
};
export const EdgeCases: Story = {
  args: {
    fileDiff: createDiffViewerFixture({ newContent: "" }),
  },
};
export const Deleted: Story = {
  args: {
    fileDiff: createDiffViewerFixture({ status: "deleted" }),
  },
};
