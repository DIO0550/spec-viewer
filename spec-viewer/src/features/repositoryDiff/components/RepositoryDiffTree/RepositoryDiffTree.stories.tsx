import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { RepositoryDiffTree } from ".";

const file = {
  id: "row:main",
  path: "src/main.ts",
  name: "main.ts",
  kind: "file",
  entryKind: "regular",
  contentClassification: "text",
  oldPath: null,
  change: "modified",
  ignored: false,
  deferredNodeId: null,
  children: { state: "loaded", items: [], nextCursor: null, message: null },
} as const;

const source = {
  id: "row:src",
  path: "src",
  name: "src",
  kind: "directory",
  entryKind: null,
  contentClassification: null,
  oldPath: null,
  change: null,
  ignored: false,
  deferredNodeId: null,
  children: { state: "loaded", items: [file], nextCursor: null, message: null },
} as const;

const deferred = {
  id: "row:vendor",
  path: "vendor",
  name: "vendor",
  kind: "directory",
  entryKind: null,
  contentClassification: null,
  oldPath: null,
  change: null,
  ignored: true,
  deferredNodeId: "in1_vendor",
  children: { state: "deferred", items: [], nextCursor: null, message: null },
} as const;

const meta = {
  component: RepositoryDiffTree,
  args: {
    filter: "changed",
    nodes: [source],
    selectedPath: null,
    expandedPaths: ["src"],
    availability: { status: "ready" },
    onSelectFile: fn(),
    onToggleDirectory: fn(),
    onLoadChildren: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof RepositoryDiffTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllProps: Story = {
  args: {
    filter: "all",
    nodes: [source, deferred],
    selectedPath: "src/main.ts",
    expandedPaths: ["src", "vendor"],
  },
};

export const Loading: Story = {
  args: { availability: { status: "loading" } },
};

export const Empty: Story = {
  args: { nodes: [], expandedPaths: [], availability: { status: "empty" } },
};

export const ErrorState: Story = {
  args: { availability: { status: "error", message: "overview failed" } },
};

export const Stale: Story = {
  args: { availability: { status: "stale", message: "stale snapshot" } },
};
