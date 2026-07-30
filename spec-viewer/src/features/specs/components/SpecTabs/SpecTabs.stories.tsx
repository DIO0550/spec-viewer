import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import type { SpecNode } from "@/features/specs/types/spec";

import { SpecTabs } from ".";

const sampleSpec: SpecNode = {
  id: "phase-1-viewer",
  label: "Phase 1 Viewer",
  kind: "spec",
  sourceGroupId: "primary",
  relativeId: "phase-1-viewer",
  presentDocumentCount: 0,
  descendantSpecCount: 0,
  files: [
    {
      key: "impl",
      label: "Implementation",
      fileName: "implementation-plan.md",
      status: "present",
      configSource: "workspaceConfig",
    },
    {
      key: "tasks",
      label: "Tasks",
      fileName: "tasks.md",
      status: "present",
      configSource: "default",
    },
    {
      key: "tech-reference",
      label: "Tech Reference",
      fileName: "tech-reference.html",
      status: "missing",
      format: "html",
      configSource: "specOverride",
    },
  ],
  children: [],
};

const meta: Meta<typeof SpecTabs> = {
  component: SpecTabs,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    spec: sampleSpec,
    selectedFileKey: "tasks",
    isSelectionDisabled: false,
    onSelectFile: fn(),
  },
  argTypes: {
    spec: { control: false },
    onSelectFile: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof SpecTabs>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    selectedFileKey: "tech-reference",
    isSelectionDisabled: true,
  },
};

export const EdgeCases: Story = {
  args: {
    spec: null,
    selectedFileKey: null,
  },
};

export const Empty: Story = {
  args: {
    spec: {
      ...sampleSpec,
      files: [],
    },
    selectedFileKey: null,
  },
};
