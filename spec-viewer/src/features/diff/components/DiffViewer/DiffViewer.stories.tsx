import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import {
  createFileReviewFixture,
  createLargeFileReviewFixture,
} from "@/features/diff/components/DiffViewer/testFixtures";

const meta = {
  component: DiffViewer,
  parameters: { layout: "fullscreen" },
  argTypes: {
    review: { control: false },
  },
} satisfies Meta<typeof DiffViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddedOnly: Story = {
  args: {
    review: createFileReviewFixture({
      status: "added",
      lines: [
        { kind: "added", text: "export const added = true;" },
        {
          kind: "added",
          text: `export const longLine = "${"x".repeat(240)}";`,
        },
      ],
    }),
  },
};

export const RemovedOnly: Story = {
  args: {
    review: createFileReviewFixture({
      status: "deleted",
      lines: [
        { kind: "removed", text: "export const legacy = true;" },
        { kind: "removed", text: "export const obsolete = true;" },
      ],
    }),
  },
};

export const Mixed: Story = {
  args: {
    review: createFileReviewFixture({
      lines: [
        ...Array.from({ length: 8 }, (_, index) => ({
          kind: "context" as const,
          text: `context ${index + 1}`,
        })),
        { kind: "removed", text: "const first = before;" },
        { kind: "added", text: "const first = after;" },
        { kind: "context", text: "between" },
        { kind: "removed", text: "const second = before;" },
        { kind: "added", text: "const second = after;" },
        { kind: "noNewline", text: "\\ No newline at end of file" },
      ],
    }),
  },
  /**
   * Verifies switching to side-by-side mode, navigating to the next change
   * disabling the "next" control at the last change, and expanding a
   * collapsed gap removes its expand button.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Side by side" }));
    await expect(
      canvas.getByRole("radio", { name: "Side by side" }),
    ).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "次の変更" }));
    await expect(
      canvas.getByRole("button", { name: "次の変更" }),
    ).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "省略した2行を展開" }),
    );
    await expect(
      canvas.queryByRole("button", { name: "省略した2行を展開" }),
    ).not.toBeInTheDocument();
  },
};

export const LargeDiff: Story = {
  args: { review: createLargeFileReviewFixture() },
  /**
   * Verifies the virtualized row window never renders more than the
   * semantic row hard cap, regardless of the diff's total size.
   *
   * @param context - Storybook play context providing the rendered canvas element.
   */
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll(".diff-viewer__row").length,
    ).toBeLessThanOrEqual(500);
  },
};

export const EmptyDiff: Story = {
  args: { review: createFileReviewFixture({ lines: [] }) },
};

export const OmittedDiff: Story = {
  args: {
    review: createFileReviewFixture({ omissionReason: "largeFile" }),
  },
};
