import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { MarkdownViewerHeader } from "./index";

const interactiveSearchHandlers = {
  onQueryChange: fn(),
  onPrevious: fn(),
  onNext: fn(),
  onClear: fn(),
};

const meta: Meta<typeof MarkdownViewerHeader> = {
  component: MarkdownViewerHeader,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <article className="markdown-viewer" style={{ minHeight: "100dvh" }}>
        <Story />
      </article>
    ),
  ],
  args: {
    selectedSpecLabel: "Later Phases",
    selectedFileLabel: "Tasks",
    fileKey: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks/later-phases/p7-02-markdown-copy-selection-reliability.md",
    htmlZoom: null,
    documentSearch: {
      query: "",
      statusText: "0件",
      hasMatches: false,
      disabled: false,
      ...interactiveSearchHandlers,
    },
    onReload: fn(),
  },
  argTypes: {
    htmlZoom: { control: false },
    documentSearch: { control: false },
    onReload: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownViewerHeader>;

export const Default: Story = {};

export const HtmlPreviewControls: Story = {
  args: {
    selectedSpecLabel: "Tech Reference Tab",
    selectedFileLabel: "Tech Reference",
    fileKey: "tech-reference",
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/tech-reference-tab/tech-reference.html",
    htmlZoom: {
      zoomPercentLabel: "110%",
      canDecrease: true,
      canIncrease: true,
      onDecrease: fn(),
      onIncrease: fn(),
    },
    documentSearch: {
      query: "schema",
      statusText: "2/8",
      hasMatches: true,
      disabled: false,
      ...interactiveSearchHandlers,
    },
  },
};

export const EdgeCases: Story = {
  args: {
    selectedSpecLabel: null,
    selectedFileLabel: null,
    fileKey: "implementation-plan",
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/063-markdown-viewer-components/implementation-plan.md",
    documentSearch: {
      query: "missing phrase",
      statusText: "0件",
      hasMatches: false,
      disabled: false,
      ...interactiveSearchHandlers,
    },
  },
};
