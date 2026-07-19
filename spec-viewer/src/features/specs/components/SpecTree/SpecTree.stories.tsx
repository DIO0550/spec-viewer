import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { SpecTreeState } from "@/features/specs/domain/specTreeState";
import type { SpecTreeState as SpecTreeStateType } from "@/features/specs/domain/specTreeState";
import type { SpecNode } from "@/features/specs/types/spec";

import { SpecTree } from ".";

const workspacePath = "/workspace/spec-reviewer";
const sampleSpec: SpecNode = {
  id: "phase-1-viewer",
  label: "Phase 1 Viewer",
  files: [
    {
      key: "tasks",
      label: "Tasks",
      fileName: "tasks.md",
      status: "present",
    },
  ],
  children: [
    {
      id: "phase-1-comments",
      label: "Phase 1 Comments",
      files: [
        {
          key: "requirements",
          label: "Requirements",
          fileName: "requirements.html",
          status: "missing",
          format: "html",
        },
      ],
      children: [],
    },
  ],
};

const readyState: SpecTreeStateType = {
  status: "ready",
  workspacePath,
  tree: { specs: [sampleSpec] },
  error: null,
};

const treeError = {
  feature: "specs" as const,
  code: "specTreeScan" as const,
  message: "The spec tree could not be scanned.",
  cause: {
    command: "list_specs" as const,
    code: "specTreeScan" as const,
    message: "The spec tree could not be scanned.",
    raw: "story fixture",
  },
};

const meta: Meta<typeof SpecTree> = {
  component: SpecTree,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 360, width: 300 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    state: readyState,
    selectedSpecId: "phase-1-viewer",
    archivingSpecId: null,
    isLoading: false,
    onSelectSpec: fn(),
    onArchiveSpec: fn(),
    onReload: fn(),
  },
  argTypes: {
    state: { control: false },
    onSelectSpec: { control: false },
    onArchiveSpec: { control: false },
    onReload: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof SpecTree>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    archivingSpecId: "phase-1-comments",
    isLoading: true,
  },
};

export const Loading: Story = {
  args: {
    state: SpecTreeState.loading(workspacePath),
    selectedSpecId: null,
  },
};

export const Error: Story = {
  args: {
    state: SpecTreeState.failed(workspacePath, treeError),
    selectedSpecId: null,
  },
};

export const Empty: Story = {
  args: {
    state: SpecTreeState.loaded(workspacePath, { specs: [] }),
    selectedSpecId: null,
  },
};

export const EdgeCases: Story = {
  args: {
    state: SpecTreeState.idle(),
    selectedSpecId: null,
    onArchiveSpec: undefined,
  },
};
