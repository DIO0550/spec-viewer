import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { fn } from "storybook/test";

import type { SpecDocumentState, SpecTreeState } from "../hooks/useSpecs";
import type {
  SpecDocument,
  SpecFileKey,
  SpecNode,
  SpecTree as SpecTreeShape,
} from "../types/spec";
import { AppShell } from "./AppShell";
import { MarkdownViewer } from "./MarkdownViewer";
import { SpecTabs } from "./SpecTabs";
import { SpecTree } from "./SpecTree";
import { WorkspaceToolbar } from "./WorkspaceToolbar";

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
    {
      key: "impl",
      label: "Implementation",
      fileName: "implementation-plan.md",
      status: "missing",
    },
    {
      key: "design",
      label: "Design",
      fileName: "design.md",
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
          fileName: "requirements.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const sampleTree: SpecTreeShape = {
  specs: [sampleSpec],
};

const sampleDocument: SpecDocument = {
  key: "tasks",
  path: "/workspace/spec-reviewer/docs/plans/tasks/phase-1-viewer/p1-13-layout-components.md",
  contents: [
    "# P1.14 Markdown Rendering",
    "",
    "> Render review planning documents with anchors ready for comments.",
    "",
    "## Acceptance",
    "",
    "- [x] Headings and lists",
    "- [x] Fenced code blocks",
    "- [ ] Comment behavior follows in P1.15",
    "",
    "```ts",
    'const blockType = "heading";',
    "```",
    "",
    "| Element | Status |",
    "| --- | --- |",
    "| GFM table | Ready |",
    "| External link | [Docs](https://example.com/docs) |",
  ].join("\n"),
  missing: false,
};

const readyTreeState: SpecTreeState = {
  status: "ready",
  workspacePath,
  tree: sampleTree,
  error: null,
};

const readyDocumentState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: sampleSpec.id,
  fileKey: "tasks",
  document: sampleDocument,
  error: null,
};

const meta = {
  component: AppShell,
  argTypes: {
    toolbar: { control: false },
    sidebar: { control: false },
    tabs: { control: false },
    viewer: { control: false },
  },
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: createShellArgs({
    treeState: readyTreeState,
    documentState: readyDocumentState,
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
  }),
};

export const Loading: Story = {
  args: createShellArgs({
    treeState: {
      status: "loading",
      workspacePath,
      tree: null,
      error: null,
    },
    documentState: {
      status: "loading",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "tasks",
      document: null,
      error: null,
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    isWorkspaceLoading: true,
  }),
};

export const Empty: Story = {
  args: createShellArgs({
    treeState: {
      status: "empty",
      workspacePath,
      tree: { specs: [] },
      error: null,
    },
    documentState: {
      status: "idle",
      workspacePath,
      specId: null,
      fileKey: null,
      document: null,
      error: null,
    },
    selectedSpec: null,
    selectedFileKey: null,
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
  }),
};

export const Error: Story = {
  args: createShellArgs({
    treeState: {
      status: "error",
      workspacePath,
      tree: null,
      error: {
        code: "specTreeScan",
        message: "Spec directory could not be scanned.",
        raw: "Spec directory could not be scanned.",
      },
    },
    documentState: {
      status: "error",
      workspacePath,
      specId: sampleSpec.id,
      fileKey: "tasks",
      document: null,
      error: {
        code: "markdownRead",
        message: "Markdown file could not be read.",
        raw: "Markdown file could not be read.",
      },
    },
    selectedSpec: sampleSpec,
    selectedFileKey: "tasks",
    workspaceInput: workspacePath,
    workspaceStatusPath: workspacePath,
    workspaceErrorMessage: "Workspace loaded with file warnings.",
  }),
};

type ShellArgsOptions = Readonly<{
  treeState: SpecTreeState;
  documentState: SpecDocumentState;
  selectedSpec: SpecNode | null;
  selectedFileKey: SpecFileKey | null;
  workspaceInput: string;
  workspaceStatusPath: string | null;
  workspaceErrorMessage?: string;
  isWorkspaceLoading?: boolean;
}>;

/** @returns AppShell story args for a representative viewer state. */
function createShellArgs({
  treeState,
  documentState,
  selectedSpec,
  selectedFileKey,
  workspaceInput,
  workspaceStatusPath,
  workspaceErrorMessage = undefined,
  isWorkspaceLoading = false,
}: ShellArgsOptions): ComponentProps<typeof AppShell> {
  const selectedFile =
    selectedSpec?.files.find((file) => file.key === selectedFileKey) ?? null;

  return {
    toolbar: (
      <WorkspaceToolbar
        workspacePath={workspaceStatusPath}
        inputValue={workspaceInput}
        isLoading={isWorkspaceLoading}
        errorMessage={workspaceErrorMessage ?? null}
        onInputChange={fn()}
        onLoad={fn()}
        onReset={fn()}
      />
    ),
    sidebar: (
      <SpecTree
        state={treeState}
        selectedSpecId={selectedSpec?.id ?? null}
        onSelectSpec={fn()}
        onReload={fn()}
      />
    ),
    tabs: (
      <SpecTabs
        spec={selectedSpec}
        selectedFileKey={selectedFileKey}
        onSelectFile={fn()}
      />
    ),
    viewer: (
      <MarkdownViewer
        state={documentState}
        selectedSpecLabel={selectedSpec?.label ?? null}
        selectedFileLabel={selectedFile?.label ?? null}
        onReload={fn()}
      />
    ),
  };
}
