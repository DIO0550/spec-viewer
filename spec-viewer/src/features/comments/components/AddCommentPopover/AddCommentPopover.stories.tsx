import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import type { CommentAnchorDraft } from "@/features/comments/types/comment";
import { AddCommentPopover } from "@/features/comments/components/AddCommentPopover";

const defaultDraft: CommentAnchorDraft = {
  anchor: createCommentAnchorTestFixture({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 2,
    textHash: "sha256:12345678",
    textSnippet: "selected requirement text",
    charRange: {
      start: 4,
      end: 29,
    },
  }),
  selectionBounds: {
    top: 24,
    left: 32,
    width: 120,
    height: 18,
  },
};

const longExcerptDraft: CommentAnchorDraft = {
  ...defaultDraft,
  anchor: createCommentAnchorTestFixture({
    ...defaultDraft.anchor,
    textSnippet:
      "This selected Markdown excerpt is intentionally long so the dialog body needs to scroll while the footer actions remain available. ".repeat(
        5,
      ),
    charRange: {
      start: 0,
      end: 620,
    },
  }),
};

const meta: Meta<typeof AddCommentPopover> = {
  component: AddCommentPopover,
  args: {
    draft: defaultDraft,
    style: {
      top: 24,
      left: 24,
    },
    isSaving: false,
    errorMessage: null,
    isScopeReady: true,
    onSubmit: fn(),
    onCancel: fn(),
  },
  argTypes: {
    onSubmit: { control: false },
    onCancel: { control: false },
    style: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof AddCommentPopover>;

export const Default: Story = {};

export const SmallViewportLongExcerpt: Story = {
  args: {
    draft: longExcerptDraft,
    style: {
      top: 8,
      left: 8,
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
