import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { SpecArtifactViewer } from "@/features/specs/components/SpecArtifactViewer";
import type { RenderedDocumentPort } from "@/features/specs/components/MarkdownViewer/renderedDocument";
import { SpecBundleState } from "@/features/specs/domain/specBundleState";
import { SpecFeatureError } from "@/features/specs/domain/specError";
import type { SpecArtifact, SpecBundle } from "@/features/specs/types/spec";
import { LoadSpecBundleCommandError } from "@/lib/api/tauri/loadSpecBundle";

const artifact: SpecArtifact = {
  identity: { kind: "directMarkdown", fileName: "Notes.md" },
  fileKey: null,
  fileName: "Notes.md",
  label: "Notes",
  format: "markdown",
  progress: "completed",
  path: ".plugin-workspace/.specs/081/Notes.md",
  contents: "# Safe notes\n\n<script>window.__unsafe = true</script>",
  blocks: [
    {
      blockType: "heading",
      blockIndex: 0,
      textHash: "sha256:safe-notes",
      textSnippet: "Safe notes",
      sourceRange: null,
    },
  ],
  error: null,
};

const bundle: SpecBundle = {
  specId: "081",
  progress: "completed",
  artifacts: [artifact],
};

function renderViewer(
  bundleState = SpecBundleState.loaded(bundle),
  selectedArtifact: SpecArtifact | null = artifact,
  renderedDocumentPort?: RenderedDocumentPort,
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onReload = vi.fn();
  act(() => {
    root.render(
      <SpecArtifactViewer
        bundleState={bundleState}
        artifact={selectedArtifact}
        workspacePath="/workspace/spec-viewer"
        selectedSpecLabel="Issue 194"
        renderedDocumentPort={renderedDocumentPort}
        onReload={onReload}
      />,
    );
  });
  return {
    container,
    onReload,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("direct Markdownを既存rendererへ接続しraw scriptを実行しない", () => {
  const result = renderViewer();

  expect(result.container.querySelector("h1")?.textContent).toBe("Notes");
  expect(
    result.container.querySelector(".markdown-rendered h1")?.textContent,
  ).toBe("Safe notes");
  expect(result.container.querySelector("script")).toBeNull();
  expect(result.container.textContent).toContain("Direct Markdown");
  result.unmount();
});

test("direct Markdownはコメント追加UIを無効化しread-only表示にする", () => {
  const result = renderViewer();

  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).toBeNull();
  result.unmount();
});

const standardArtifact: SpecArtifact = {
  identity: { kind: "standard", fileKey: "impl" },
  fileKey: "impl",
  fileName: "implementation-plan.md",
  label: "Implementation Plan",
  format: "markdown",
  progress: "inProgress",
  path: ".plugin-workspace/.specs/081/implementation-plan.md",
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

test("direct Markdownは渡されたrendered document portを接続しない", () => {
  const renderOverlay = vi.fn(() => "direct overlay");
  const renderedDocumentPort: RenderedDocumentPort = {
    rootRef: createRef<HTMLDivElement>(),
    isOverlayOpen: false,
    projectBlock: () => null,
    onRenderedDocumentCommit: vi.fn(),
    renderOverlay,
  };
  const result = renderViewer(
    SpecBundleState.loaded(bundle),
    artifact,
    renderedDocumentPort,
  );

  expect(renderOverlay).not.toHaveBeenCalled();
  expect(result.container.textContent).not.toContain("direct overlay");
  result.unmount();
});

test("standard artifactもpure adapter単体ではコメントUIを表示しない", () => {
  const result = renderViewer(
    SpecBundleState.loaded({ ...bundle, artifacts: [standardArtifact] }),
    standardArtifact,
  );

  expect(
    result.container.querySelector(".markdown-block-comment-button"),
  ).toBeNull();
  expect(result.container.textContent).toContain("Standard artifact");
  result.unmount();
});

test("statusパネルはtab UIと関連付くtabpanel roleを維持する", () => {
  const loading = renderViewer(SpecBundleState.loading(), null);
  const loadingPanel = loading.container.querySelector(
    "#markdown-viewer-panel",
  );
  expect(loadingPanel?.getAttribute("role")).toBe("tabpanel");
  expect(loadingPanel?.getAttribute("tabindex")).toBe("-1");
  loading.unmount();
});

test("zero artifactsをbundle errorと区別する", () => {
  const result = renderViewer(
    SpecBundleState.loaded({
      specId: "081",
      progress: "notStarted",
      artifacts: [],
    }),
    null,
  );

  expect(result.container.textContent).toContain("No artifacts");
  expect(result.container.getAttribute("role")).toBeNull();
  result.unmount();
});

test("loadingとbundle errorをretry可能なstatusとして区別する", () => {
  const loading = renderViewer(SpecBundleState.loading(), null);
  expect(loading.container.textContent).toContain("Loading spec artifacts");
  expect(loading.container.querySelector("[aria-live=polite]")).not.toBeNull();
  loading.unmount();

  const failed = renderViewer(
    SpecBundleState.failed(
      SpecFeatureError.fromCommandError(
        LoadSpecBundleCommandError.unknown(
          "Bundle unavailable.",
          new Error("Bundle unavailable."),
        ),
      ),
    ),
    null,
  );
  expect(failed.container.querySelector("[role=alert]")?.textContent).toContain(
    "Bundle unavailable.",
  );
  act(() => {
    (failed.container.querySelector("button") as HTMLButtonElement).click();
  });
  expect(failed.onReload).toHaveBeenCalledOnce();
  failed.unmount();
});

test("selected unknown artifactはcode/message/reloadと他tab継続を表示する", () => {
  const unknownArtifact: SpecArtifact = {
    ...artifact,
    progress: "unknown",
    contents: null,
    error: { code: "markdownRead", message: "Could not read artifact." },
  };
  const result = renderViewer(
    SpecBundleState.loaded({ ...bundle, artifacts: [unknownArtifact] }),
    unknownArtifact,
  );

  expect(
    result.container.querySelector('[role="alert"]')?.textContent,
  ).toContain("markdownRead: Could not read artifact.");
  expect(result.container.textContent).toContain(
    "Other artifact tabs remain available.",
  );
  act(() => {
    (result.container.querySelector("button") as HTMLButtonElement).click();
  });
  expect(result.onReload).toHaveBeenCalledOnce();
  result.unmount();
});
