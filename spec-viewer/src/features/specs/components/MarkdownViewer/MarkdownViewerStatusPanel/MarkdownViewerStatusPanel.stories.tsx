import * as TestValues from "@/shared/testing/validatedValueObjects";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { fn } from "storybook/test";

import { toSpecFeatureError } from "@/features/specs";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import type { SpecDocument } from "@/features/specs/types/spec";
import { MarkdownViewerStatusPanel } from "./index";

const workspacePath = "/workspace/spec-reviewer";

function createDocument(
  contents: string | null,
  missing = false,
): SpecDocument {
  return {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks.md",
    contents,
    missing,
    blocks: [],
  };
}

const idleState: SpecDocumentState = {
  status: "idle",
  workspacePath: null,
  specId: null,
  fileKey: null,
  document: null,
  error: null,
};

const loadingState: SpecDocumentState = {
  status: "loading",
  workspacePath,
  specId: TestValues.specId("phase-1-viewer"),
  fileKey: "tasks",
  document: null,
  error: null,
};

const errorState: SpecDocumentState = {
  status: "error",
  workspacePath,
  specId: TestValues.specId("phase-1-viewer"),
  fileKey: "tasks",
  document: null,
  error: toSpecFeatureError("read", {
    code: "markdownRead",
    message: "Markdown file could not be read.",
  }),
};

const missingState: SpecDocumentState = {
  status: "missing",
  workspacePath,
  specId: TestValues.specId("phase-1-viewer"),
  fileKey: "tasks",
  document: createDocument(null, true),
  error: null,
};

const emptyState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: TestValues.specId("phase-1-viewer"),
  fileKey: "tasks",
  document: createDocument(" \n\t "),
  error: null,
};

const meta: Meta<typeof MarkdownViewerStatusPanel> = {
  component: MarkdownViewerStatusPanel,
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => (
    <MarkdownViewerStatusPanel {...args} panelRef={createRef<HTMLElement>()} />
  ),
  args: {
    state: idleState,
    selectedSpecLabel: null,
    panelRef: createRef<HTMLElement>(),
    onReload: fn(),
  },
  argTypes: {
    state: { control: false },
    panelRef: { control: false },
    onReload: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownViewerStatusPanel>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    state: loadingState,
    selectedSpecLabel: "Phase 1 Viewer",
  },
};

export const Error: Story = {
  args: {
    state: errorState,
    selectedSpecLabel: "Phase 1 Viewer",
  },
};

export const Missing: Story = {
  args: {
    state: missingState,
    selectedSpecLabel: "Phase 1 Viewer",
  },
};

export const Empty: Story = {
  args: {
    state: emptyState,
    selectedSpecLabel: "Phase 1 Viewer",
  },
};

export const EdgeCases: Story = {
  args: {
    state: {
      ...idleState,
      workspacePath,
      specId: TestValues.specId("phase-1-viewer"),
    },
    selectedSpecLabel: "Phase 1 Viewer",
  },
};
