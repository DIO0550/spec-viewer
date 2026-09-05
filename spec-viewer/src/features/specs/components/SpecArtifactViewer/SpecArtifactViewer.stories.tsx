import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { SpecArtifactViewer } from ".";
import { SpecBundleState } from "@/features/specs/domain/specBundleState";
import type { SpecArtifact, SpecBundle } from "@/features/specs/types/spec";

const markdownArtifact: SpecArtifact = {
  identity: { kind: "directMarkdown", fileName: "Notes.md" },
  fileKey: null,
  fileName: "Notes.md",
  label: "Notes",
  format: "markdown",
  progress: "completed",
  path: ".plugin-workspace/.specs/081/Notes.md",
  contents:
    "# Notes\n\nA direct Markdown artifact.\n\n<script>window.__specViewerUnsafe = true</script>",
  blocks: [
    {
      blockType: "heading",
      blockIndex: 0,
      textHash: "sha256:notes",
      textSnippet: "Notes",
      sourceRange: null,
    },
    {
      blockType: "paragraph",
      blockIndex: 1,
      textHash: "sha256:direct-markdown",
      textSnippet: "A direct Markdown artifact.",
      sourceRange: null,
    },
  ],
  error: null,
};

const bundle: SpecBundle = {
  specId: "081-issue-194",
  progress: "completed",
  artifacts: [markdownArtifact],
};

const meta = {
  component: SpecArtifactViewer,
  args: {
    bundleState: SpecBundleState.loaded(bundle),
    artifact: markdownArtifact,
    workspacePath: "/workspace/project",
    selectedSpecLabel: "Issue 194",
    onReload: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 920 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpecArtifactViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { bundleState: SpecBundleState.loading(), artifact: null },
};

export const ZeroArtifacts: Story = {
  args: {
    bundleState: SpecBundleState.loaded({
      specId: "081-issue-194",
      progress: "notStarted",
      artifacts: [],
    }),
    artifact: null,
  },
};

export const EmptyDocument: Story = {
  args: {
    artifact: { ...markdownArtifact, contents: "", progress: "notStarted" },
  },
};

export const PartialReadError: Story = {
  args: {
    bundleState: SpecBundleState.loaded({
      ...bundle,
      progress: "unknown",
      artifacts: [
        markdownArtifact,
        {
          ...markdownArtifact,
          identity: { kind: "directMarkdown", fileName: "Broken.md" },
          fileName: "Broken.md",
          label: "Broken",
          progress: "unknown",
          contents: null,
          error: { code: "markdownRead", message: "Could not read artifact." },
        },
      ],
    }),
    artifact: {
      ...markdownArtifact,
      identity: { kind: "directMarkdown", fileName: "Broken.md" },
      fileName: "Broken.md",
      label: "Broken",
      progress: "unknown",
      contents: null,
      error: { code: "markdownRead", message: "Could not read artifact." },
    },
  },
};

const wideRow = `| ${"wide-column-".repeat(20)} | value |`;
const longMarkdown = `# Large document\n\n${"Long paragraph. ".repeat(14_000)}\n\n| Key | Value |\n| --- | --- |\n${wideRow}\n\n\`\`\`ts\nconst value = "${"wide-code-".repeat(80)}";\n\`\`\``;
const longBlocks = [
  {
    blockType: "heading",
    blockIndex: 0,
    textHash: "sha256:large-document",
    textSnippet: "Large document",
    sourceRange: null,
  },
  {
    blockType: "paragraph",
    blockIndex: 1,
    textHash: "sha256:long-paragraph",
    textSnippet: "Long paragraph.",
    sourceRange: null,
  },
  {
    blockType: "table",
    blockIndex: 2,
    textHash: "sha256:wide-table",
    textSnippet: "Key Value",
    sourceRange: null,
  },
  {
    blockType: "code_block",
    blockIndex: 3,
    textHash: "sha256:wide-code",
    textSnippet: "const value",
    sourceRange: null,
  },
] as const;

export const LongMarkdownWithWideTableAndCode: Story = {
  args: {
    artifact: {
      ...markdownArtifact,
      contents: longMarkdown,
      blocks: longBlocks,
    },
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
