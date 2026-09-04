import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";

const createTextHash = (value: string): string => value;
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import type { MarkdownBlockMetadata } from "@/features/specs/types/spec";

const workspacePath = "/workspace/spec-reviewer";
const markdownContents = [
  "# Selection reliability",
  "",
  "Users can select only this paragraph fragment without activating the highlight.",
  "",
  "- Copy should keep the exact selected range.",
  "- Comment creation should still work from the selection button.",
  "",
  "```ts",
  'const selectedText = "paragraph fragment";',
  "```",
].join("\n");

const markdownBlocks: readonly MarkdownBlockMetadata[] = [
  {
    blockType: "heading",
    blockIndex: 0,
    textHash: createTextHash("Selection reliability"),
    textSnippet: "Selection reliability",
    sourceRange: null,
  },
  {
    blockType: "paragraph",
    blockIndex: 1,
    textHash: createTextHash(
      "Users can select only this paragraph fragment without activating the highlight.",
    ),
    textSnippet:
      "Users can select only this paragraph fragment without activating the highlight.",
    sourceRange: null,
  },
  {
    blockType: "list_item",
    blockIndex: 2,
    textHash: createTextHash("Copy should keep the exact selected range."),
    textSnippet: "Copy should keep the exact selected range.",
    sourceRange: null,
  },
  {
    blockType: "list_item",
    blockIndex: 3,
    textHash: createTextHash(
      "Comment creation should still work from the selection button.",
    ),
    textSnippet:
      "Comment creation should still work from the selection button.",
    sourceRange: null,
  },
  {
    blockType: "code_block",
    blockIndex: 4,
    textHash: createTextHash('const selectedText = "paragraph fragment";'),
    textSnippet: 'const selectedText = "paragraph fragment";',
    sourceRange: null,
  },
];

const readyState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: "selection-reliability",
  fileKey: "tasks",
  document: {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks/later-phases/p7-02-markdown-copy-selection-reliability.md",
    contents: markdownContents,
    missing: false,
    blocks: markdownBlocks,
  },
  error: null,
};

const techReferenceHtmlContents = [
  "<!doctype html>",
  "<html>",
  "<body>",
  "<main>",
  '<h1 id="overview">Tech Reference</h1>',
  '<nav><a href="#overview">Overview</a> <a href="#schema-notes">Schema notes</a></nav>',
  "<p>API surfaces, schema notes, and integration hints stay readable as HTML.</p>",
  "<pre>GET /v1/specs/{workspaceId}/tech-reference?include=api,schema,integration,wide-reference-column</pre>",
  "<table>",
  "<thead><tr><th>Surface</th><th>Reference</th><th>Notes</th></tr></thead>",
  "<tbody><tr><td>IPC</td><td>read_spec_document</td><td>HTML preview keeps wide technical content inside the viewer.</td></tr></tbody>",
  "</table>",
  '<h2 id="schema-notes">Schema notes</h2>',
  "<p>Table of contents links stay inside the sandboxed HTML preview.</p>",
  "</main>",
  "</body>",
  "</html>",
].join("");

const techReferenceHtmlState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: "tech-reference-tab",
  fileKey: "tech-reference",
  document: {
    key: "tech-reference",
    format: "html",
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/tech-reference-tab/tech-reference.html",
    contents: techReferenceHtmlContents,
    missing: false,
    blocks: [],
  },
  error: null,
};

const testCasesHtmlContents = [
  "<!doctype html>",
  "<html>",
  "<head><title>Source-only case noise</title></head>",
  "<body>",
  "<main>",
  '<h1 id="cases">Test Cases</h1>',
  '<p data-search-noise="edge scenario">Searchable body case for login and logout scenarios.</p>',
  "<script>Searchable body case script noise</script>",
  "<style>.searchable-body-case { color: red; }</style>",
  "<table><tbody><tr><td>Scenario</td><td>Expected result</td></tr><tr><td>Login</td><td>Dashboard opens</td></tr></tbody></table>",
  "</main>",
  "</body>",
  "</html>",
].join("");

const testCasesHtmlState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: "test-cases-tab",
  fileKey: "test-cases",
  document: {
    key: "test-cases",
    format: "html",
    path: "/workspace/spec-reviewer/.plugin-workspace/.specs/test-cases-tab/test-cases.html",
    contents: testCasesHtmlContents,
    missing: false,
    blocks: [],
  },
  error: null,
};

const mermaidContents = [
  "# Review flow",
  "",
  "```mermaid",
  "flowchart LR",
  "  Draft[Draft spec] --> Review{Review}",
  "  Review -->|Approve| Done[Ready to implement]",
  "  Review -->|Request changes| Draft",
  "```",
].join("\n");

const mermaidState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: "mermaid-preview",
  fileKey: "tasks",
  document: {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/mermaid-preview.md",
    contents: mermaidContents,
    missing: false,
    blocks: [
      {
        blockType: "heading",
        blockIndex: 0,
        textHash: createTextHash("Review flow"),
        textSnippet: "Review flow",
        sourceRange: null,
      },
      {
        blockType: "code_block",
        blockIndex: 1,
        textHash: createTextHash(
          "flowchart LR\n  Draft[Draft spec] --> Review{Review}\n  Review -->|Approve| Done[Ready to implement]\n  Review -->|Request changes| Draft",
        ),
        textSnippet: "flowchart LR Draft spec Review Ready to implement",
        sourceRange: null,
      },
    ],
  },
  error: null,
};

const meta: Meta<typeof MarkdownViewer> = {
  component: MarkdownViewer,
  args: {
    state: readyState,
    selectedSpecLabel: "Later Phases",
    selectedFileLabel: "Tasks",
    onReload: fn(),
  },
  argTypes: {
    onReload: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownViewer>;

export const Default: Story = {};

export const MermaidDiagram: Story = {
  args: {
    state: mermaidState,
    selectedSpecLabel: "Diagram preview",
    selectedFileLabel: "Review flow",
  },
};

export const TechReferenceHtmlPreview: Story = {
  parameters: {
    layout: "fullscreen",
  },
  /**
   * Renders the story inside a full-height app shell wrapper.
   * @param args - Story args forwarded to the MarkdownViewer.
   */
  render: (args) => (
    <div className="app-shell__viewer" style={{ height: "100dvh" }}>
      <MarkdownViewer {...args} />
    </div>
  ),
  args: {
    state: techReferenceHtmlState,
    selectedSpecLabel: "Tech Reference Tab",
    selectedFileLabel: "Tech Reference",
  },
};

export const TestCasesHtml: Story = {
  parameters: {
    layout: "fullscreen",
  },
  /**
   * Renders the story inside a full-height app shell wrapper.
   * @param args - Story args forwarded to the MarkdownViewer.
   */
  render: (args) => (
    <div className="app-shell__viewer" style={{ height: "100dvh" }}>
      <MarkdownViewer {...args} />
    </div>
  ),
  args: {
    state: testCasesHtmlState,
    selectedSpecLabel: "Test Cases Tab",
    selectedFileLabel: "Test Cases",
  },
};
