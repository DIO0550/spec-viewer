import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import type { Comment } from "@/features/comments/types/comment";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import * as TestValues from "@/shared/testing/validatedValueObjects";

const commentId = TestValues.commentId;

const workspacePath = "/workspace/spec-reviewer";
const headingMarkdown = "# Selection reliability";
const highlightedParagraph =
  "Users can select only this paragraph fragment without activating the highlight.";
const firstListItemMarkdown = "- Copy should keep the exact selected range.";
const secondListItemMarkdown =
  "- Comment creation should still work from the selection button.";
const codeBlockMarkdown = [
  "```ts",
  'const selectedText = "paragraph fragment";',
  "```",
].join("\n");
const markdownContents = [
  headingMarkdown,
  "",
  highlightedParagraph,
  "",
  firstListItemMarkdown,
  secondListItemMarkdown,
  "",
  codeBlockMarkdown,
].join("\n");

function createStorySourceRange(source: string) {
  const startOffset = markdownContents.indexOf(source);

  if (startOffset < 0) {
    throw new Error(`Story Markdown source not found: ${source}`);
  }

  const encoder = new TextEncoder();
  return {
    startByteOffset: encoder.encode(markdownContents.slice(0, startOffset))
      .byteLength,
    endByteOffset: encoder.encode(
      markdownContents.slice(0, startOffset + source.length),
    ).byteLength,
  };
}

const readyState: SpecDocumentState = {
  status: "ready",
  workspacePath,
  specId: TestValues.specId("selection-reliability"),
  fileKey: "tasks",
  document: {
    key: "tasks",
    path: "/workspace/spec-reviewer/docs/plans/tasks/later-phases/p7-02-markdown-copy-selection-reliability.md",
    contents: markdownContents,
    missing: false,
    blocks: [
      {
        blockType: "heading",
        blockIndex: 0,
        textHash: "sha256:11111111",
        textSnippet: "Selection reliability",
        sourceRange: createStorySourceRange(headingMarkdown),
      },
      {
        blockType: "paragraph",
        blockIndex: 1,
        textHash: "sha256:a5dd5c34",
        textSnippet:
          "Users can select only this paragraph fragment without activating the highlight.",
        sourceRange: createStorySourceRange(highlightedParagraph),
      },
      {
        blockType: "list_item",
        blockIndex: 2,
        textHash: "sha256:22222222",
        textSnippet: "Copy should keep the exact selected range.",
        sourceRange: createStorySourceRange(firstListItemMarkdown),
      },
      {
        blockType: "list_item",
        blockIndex: 3,
        textHash: "sha256:33333333",
        textSnippet:
          "Comment creation should still work from the selection button.",
        sourceRange: createStorySourceRange(secondListItemMarkdown),
      },
      {
        blockType: "code_block",
        blockIndex: 4,
        textHash: "sha256:abc12345",
        textSnippet: 'const selectedText = "paragraph fragment";',
        sourceRange: createStorySourceRange(codeBlockMarkdown),
      },
    ],
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
  specId: TestValues.specId("tech-reference-tab"),
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
  specId: TestValues.specId("test-cases-tab"),
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

const comments: readonly Comment[] = [
  createCommentTestFixture({
    id: "cmt_active_selection",
    anchor: createCommentAnchorTestFixture({
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 1,
      textHash: "sha256:a5dd5c34",
      textSnippet: "paragraph fragment",
      charRange: {
        start: 27,
        end: 45,
      },
    }),
    body: "Verify partial selection stays copyable inside this highlight.",
    createdAt: "2026-05-07T00:00:00Z",
    updatedAt: "2026-05-07T00:00:00Z",
  }),
];

const commentCardComments: readonly Comment[] = [
  ...comments,
  createCommentTestFixture({
    id: "cmt_resolved_card",
    anchor: createCommentAnchorTestFixture({
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 1,
      textHash: "sha256:a5dd5c34",
      textSnippet: highlightedParagraph,
      charRange: {
        start: 0,
        end: highlightedParagraph.length,
      },
    }),
    body: "Resolved note stays visible without making the paragraph feel busy.",
    status: "resolved",
    createdAt: "2026-05-07T00:10:00Z",
    updatedAt: "2026-05-07T00:20:00Z",
  }),
  createCommentTestFixture({
    id: "cmt_code_card",
    anchor: createCommentAnchorTestFixture({
      fileKey: "tasks",
      blockType: "code_block",
      blockIndex: 4,
      textHash: "sha256:abc12345",
      textSnippet: "selectedText",
      charRange: {
        start: 6,
        end: 18,
      },
    }),
    body: "Code block comments keep the gutter add button available.",
    createdAt: "2026-05-07T00:30:00Z",
    updatedAt: "2026-05-07T00:30:00Z",
  }),
];

const meta: Meta<typeof MarkdownViewer> = {
  component: MarkdownViewer,
  args: {
    state: readyState,
    selectedSpecLabel: "Later Phases",
    selectedFileLabel: "Tasks",
    comments,
    activeCommentId: commentId("cmt_active_selection"),
    onReload: fn(),
    onSelectComment: fn(),
    onAddComment: fn(),
  },
  argTypes: {
    onReload: { control: false },
    onSelectComment: { control: false },
    onAddComment: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof MarkdownViewer>;

export const HighlightedSelectionSurface: Story = {
  play: async ({ canvasElement }) => {
    const highlightedBlock = canvasElement.querySelector(
      '[data-text-hash="sha256:a5dd5c34"]',
    );

    if (highlightedBlock === null) {
      throw new Error("Canonical highlighted paragraph was not rendered");
    }

    await expect(highlightedBlock).toHaveAttribute(
      "data-comment-highlight-state",
      "active",
    );
    await expect(
      canvasElement.querySelectorAll(".markdown-block-comment-button"),
    ).toHaveLength(5);
  },
};

export const ExistingCommentCards: Story = {
  args: {
    comments: commentCardComments,
    activeCommentId: commentId("cmt_active_selection"),
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
    comments: [],
    activeCommentId: null,
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
    comments: [],
    activeCommentId: null,
  },
};
