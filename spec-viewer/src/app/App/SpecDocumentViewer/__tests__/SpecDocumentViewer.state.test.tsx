import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SpecDocumentViewer } from "@/app/App/SpecDocumentViewer";
import { CommentOperationIdleState } from "@/features/comments";
import { SpecBundleState } from "@/features/specs/domain/specBundleState";
import type { SpecArtifact, SpecBundle } from "@/features/specs/types/spec";

const standardArtifact: SpecArtifact = {
  identity: { kind: "standard", fileKey: "impl" },
  fileKey: "impl",
  fileName: "implementation-plan.md",
  label: "Implementation Plan",
  format: "markdown",
  progress: "inProgress",
  path: ".plugin-workspace/.specs/091/implementation-plan.md",
  contents: "# Plan\n\nA commentable paragraph.",
  blocks: [
    {
      blockType: "heading",
      blockIndex: 0,
      textHash: "sha256:plan",
      textSnippet: "Plan",
      sourceRange: null,
    },
    {
      blockType: "paragraph",
      blockIndex: 1,
      textHash: "sha256:paragraph",
      textSnippet: "A commentable paragraph.",
      sourceRange: null,
    },
  ],
  error: null,
};

const bundle: SpecBundle = {
  specId: "091",
  progress: "inProgress",
  artifacts: [standardArtifact],
};

const directArtifact: SpecArtifact = {
  ...standardArtifact,
  identity: { kind: "directMarkdown", fileName: "Notes.md" },
  fileKey: null,
  fileName: "Notes.md",
  label: "Notes",
  path: ".plugin-workspace/.specs/091/Notes.md",
};

function createProps(artifact: SpecArtifact | null, enabled = true) {
  return {
    showOpenWorkspacePrompt: false,
    openWorkspace: {
      isOpening: false,
      recentWorkspaces: [],
      onOpenWorkspace: vi.fn(),
      onOpenRecentWorkspace: vi.fn(),
      onRemoveRecentWorkspace: vi.fn(),
    },
    viewer: {
      bundleState: SpecBundleState.loaded({
        ...bundle,
        artifacts: artifact === null ? [] : [artifact],
      }),
      artifact,
      workspacePath: "/workspace/spec-viewer",
      selectedSpecLabel: "Issue 108",
      onReload: vi.fn(),
      onFirstReadable: vi.fn(),
    },
    comments: {
      enabled,
      layer: {
        comments: [],
        activeCommentId: null,
        addState: {
          isSaving: false,
          errorMessage: null,
          isScopeReady: true,
        },
        editState: {
          isSaving: false,
          operationState: CommentOperationIdleState.create(),
        },
        actions: {
          add: vi.fn().mockResolvedValue(true),
          update: vi.fn().mockResolvedValue(true),
          resolve: vi.fn().mockResolvedValue(true),
          delete: vi.fn().mockResolvedValue(true),
          select: vi.fn(),
          reportAnchorDisplayStates: vi.fn(),
        },
      },
    },
  };
}

function renderViewer(props: ReturnType<typeof createProps>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<SpecDocumentViewer {...props} />);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("workspace未選択時はopen workspace promptだけを表示する", () => {
  const props = createProps(standardArtifact);
  const result = renderViewer({ ...props, showOpenWorkspacePrompt: true });

  expect(result.container.textContent).toContain("ワークスペースを開く");
  expect(result.container.textContent).not.toContain("Implementation Plan");
  result.unmount();
});

test.each([
  ["direct Markdown", directArtifact, true],
  ["comments disabled", standardArtifact, false],
  [
    "HTML",
    { ...standardArtifact, format: "html", blocks: [] } satisfies SpecArtifact,
    true,
  ],
  [
    "empty Markdown",
    { ...standardArtifact, contents: "   " } satisfies SpecArtifact,
    true,
  ],
] as const)("%sはcomment integrationなしで表示する", (_label, artifact, enabled) => {
  const result = renderViewer(createProps(artifact, enabled));

  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).toBeNull();
  result.unmount();
});

test("readyでnon-emptyなstandard Markdownだけcomment layerと合成する", () => {
  const result = renderViewer(createProps(standardArtifact));

  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).not.toBeNull();
  expect(result.container.textContent).toContain("Standard artifact");
  result.unmount();
});

test("comment layerはlist itemのHTML構造を壊さず操作を合成する", () => {
  const listArtifact: SpecArtifact = {
    ...standardArtifact,
    contents: "- Commentable item",
    blocks: [
      {
        blockType: "list_item",
        blockIndex: 0,
        textHash: "sha256:list-item",
        textSnippet: "Commentable item",
        sourceRange: null,
      },
    ],
  };
  const result = renderViewer(createProps(listArtifact));

  expect(result.container.querySelector("ul > li")).not.toBeNull();
  expect(result.container.querySelector("ul > div")).toBeNull();
  expect(
    result.container.querySelector("ul > li > .markdown-block-comment-button"),
  ).not.toBeNull();
  result.unmount();
});

test("loading stateはpure artifact viewerへ委譲する", () => {
  const props = createProps(null);
  const result = renderViewer({
    ...props,
    viewer: { ...props.viewer, bundleState: SpecBundleState.loading() },
  });

  expect(result.container.textContent).toContain("Loading spec artifacts");
  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).toBeNull();
  result.unmount();
});
