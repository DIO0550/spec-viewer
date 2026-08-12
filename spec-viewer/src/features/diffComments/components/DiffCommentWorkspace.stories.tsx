import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { CurrentFileViewer } from "@/features/diff/components/CurrentFileViewer";
import { DiffViewer } from "@/features/diff/components/DiffViewer";
import {
  createDiffViewerFixture,
  createLargeDiffViewerFixture,
} from "@/features/diff/components/DiffViewer/testFixtures";
import type { DiffLineCommentsController } from "@/features/diffComments/components/DiffLineCommentSlot";

type ViewerCommentsStoryProps = Readonly<{
  mode: "unified" | "split" | "editor";
  state: "controls" | "composer" | "converged";
  large: boolean;
}>;

const meta = {
  title: "Diff/Comments/ViewerIntegration",
  component: ViewerCommentsStory,
  args: { mode: "unified", state: "controls", large: false },
  argTypes: {
    mode: { control: "inline-radio", options: ["unified", "split", "editor"] },
    state: {
      control: "inline-radio",
      options: ["controls", "composer", "converged"],
    },
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ViewerCommentsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllProps: Story = { args: { mode: "split", state: "composer" } };
export const EdgeCases: Story = {
  args: { mode: "unified", state: "converged" },
};
export const UnifiedComments: Story = {
  args: { mode: "unified", state: "composer" },
};
export const SplitComments: Story = {
  args: { mode: "split", state: "controls" },
};
export const EditorComments: Story = {
  args: { mode: "editor", state: "composer" },
};
export const ConvergedComments: Story = {
  args: { mode: "unified", state: "converged" },
};

export const LargeUnified: Story = {
  args: { mode: "unified", large: true },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll(".diff-viewer__row").length,
    ).toBeLessThanOrEqual(500);
  },
};
export const LargeSplit: Story = {
  args: { mode: "split", large: true },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll(".diff-viewer__row").length,
    ).toBeLessThanOrEqual(500);
  },
};
export const LargeEditor: Story = {
  args: { mode: "editor", large: true },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll('[role="row"]').length,
    ).toBeLessThanOrEqual(500);
  },
};

function ViewerCommentsStory(props: ViewerCommentsStoryProps) {
  const fileDiff = props.large
    ? createLargeDiffViewerFixture()
    : createDiffViewerFixture({
        oldContent: "first\nold\nlast",
        newContent: "first\ncurrent\nlast",
      });
  const controller = createController(props.state);
  return props.mode === "editor" ? (
    <CurrentFileViewer fileDiff={fileDiff} lineComments={controller} />
  ) : (
    <DiffViewer
      fileDiff={fileDiff}
      mode={props.mode}
      activeChangeId={null}
      onActiveChangeIdChange={() => undefined}
      lineComments={controller}
    />
  );
}

function createController(
  state: ViewerCommentsStoryProps["state"],
): DiffLineCommentsController {
  const target = {
    key: "current:implementation-plan.md:2",
    side: "current" as const,
    sidePath: "implementation-plan.md",
    line: 2,
  };
  return {
    commentsByTarget:
      state === "converged"
        ? {
            [target.key]: [
              {
                id: "first",
                createdAt: "2026-08-11T00:00:00Z",
                label: "First",
              },
              {
                id: "second",
                createdAt: "2026-08-11T00:00:01Z",
                label: "Second",
              },
            ],
          }
        : {},
    activeCommentId: state === "converged" ? "second" : null,
    draft:
      state === "composer"
        ? {
            target,
            body: "Keyboard-accessible inline review",
            isSaving: false,
            origin: null,
          }
        : null,
    onStartDraft: () => undefined,
    onDraftBodyChange: () => undefined,
    onCancelDraft: () => undefined,
    onSubmitDraft: () => undefined,
    onSelectComment: () => undefined,
  };
}
