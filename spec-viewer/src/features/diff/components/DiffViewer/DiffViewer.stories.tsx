import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { Hunk } from "@/features/diff/domain/fileDiff";
import {
  createDiffViewerFixture,
  createLargeDiffViewerFixture,
} from "@/features/diff/components/DiffViewer/testFixtures";

const meta = {
  component: DiffViewer,
  parameters: { layout: "fullscreen" },
  argTypes: {
    fileDiff: { control: false },
  },
} satisfies Meta<typeof DiffViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddedOnly: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
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
    fileDiff: createDiffViewerFixture({
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
    fileDiff: createDiffViewerFixture({
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
    await userEvent.click(canvas.getByRole("radio", { name: "Split" }));
    await expect(canvas.getByRole("radio", { name: "Split" })).toBeChecked();
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

export const MultipleHunks: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      lines: Array.from({ length: 24 }, (_, index) => ({
        kind: "context" as const,
        text: "context " + (index + 1),
      })),
      hunks: [
        Hunk.fromLines("@@ -1,2 +1,2 @@", [
          { kind: "removed", text: "const first = before;" },
          { kind: "added", text: "const first = after;" },
        ]),
        Hunk.fromLines("@@ -20,2 +20,2 @@", [
          { kind: "removed", text: "const second = before;" },
          { kind: "added", text: "const second = after;" },
        ]),
      ],
    }),
  },
};

export const KeyboardFocus: Story = {
  args: { fileDiff: createDiffViewerFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const unified = canvas.getByRole("radio", { name: "Unified" });
    unified.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", { name: "Split" })).toBeChecked();
    await expect(unified).toHaveFocus();
  },
};

export const DarkTheme: Story = {
  globals: { theme: "Dark" },
  args: { fileDiff: createDiffViewerFixture() },
};

export const LargeDiff: Story = {
  args: { fileDiff: createLargeDiffViewerFixture() },
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
  args: { fileDiff: createDiffViewerFixture({ lines: [] }) },
};

export const OmittedDiff: Story = {
  args: {
    fileDiff: createDiffViewerFixture({ omissionReason: "largeFile" }),
  },
};

export const BinaryDiff: Story = {
  args: {
    fileDiff: createDiffViewerFixture({ omissionReason: "binary" }),
  },
};

export const MissingSideDiff: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "missingSide",
      status: "modified",
    }),
  },
};

export const UnsupportedDiff: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      omissionReason: "unsupportedEntryKind",
    }),
  },
};

export const UntrackedDiff: Story = {
  args: {
    fileDiff: createDiffViewerFixture({
      status: "untracked",
      lines: [{ kind: "added", text: "const untracked = true;" }],
    }),
  },
};
