import type { ComponentProps } from "react";
import { ErrorBoundary } from "@/components";
import {
  MarkdownCommentLayer,
  type MarkdownCommentLayerProps,
} from "@/features/comments";
import {
  type SpecArtifact,
  SpecArtifactViewer,
  type SpecArtifactViewerProps,
  type SpecBundleState,
  type SpecFileKey,
} from "@/features/specs";
import { OpenWorkspaceEmptyState } from "@/features/workspace";

export type SpecDocumentViewerProps = Readonly<{
  showOpenWorkspacePrompt: boolean;
  openWorkspace: ComponentProps<typeof OpenWorkspaceEmptyState>;
  viewer: Omit<SpecArtifactViewerProps, "renderedDocumentPort">;
  comments: Readonly<{
    enabled: boolean;
    layer: Omit<MarkdownCommentLayerProps, "fileKey" | "children">;
  }>;
}>;

/**
 * Owns the only composition boundary between specs rendering and comments.
 * @param props - Workspace prompt, pure viewer, and comment-layer inputs.
 * @returns The workspace prompt or an isolated artifact viewer boundary.
 */
export function SpecDocumentViewer({
  showOpenWorkspacePrompt,
  openWorkspace,
  viewer,
  comments,
}: SpecDocumentViewerProps) {
  if (showOpenWorkspacePrompt) {
    return <OpenWorkspaceEmptyState {...openWorkspace} />;
  }

  const artifact = viewer.artifact;
  const boundaryKey = `${viewer.bundleState.bundle?.specId ?? "no-spec"}:${
    artifact?.path ?? "no-artifact"
  }`;

  if (
    !isCommentableMarkdownArtifact(
      viewer.bundleState,
      artifact,
      comments.enabled,
    )
  ) {
    return (
      <ErrorBoundary key={boundaryKey} variant="dialog">
        <SpecArtifactViewer {...viewer} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary key={boundaryKey} variant="dialog">
      <MarkdownCommentLayer fileKey={artifact.fileKey} {...comments.layer}>
        {(renderedDocumentPort) => (
          <SpecArtifactViewer
            {...viewer}
            renderedDocumentPort={renderedDocumentPort}
          />
        )}
      </MarkdownCommentLayer>
    </ErrorBoundary>
  );
}

/** @returns Whether the selected artifact supports inline Markdown comments. */
function isCommentableMarkdownArtifact(
  bundleState: SpecBundleState,
  artifact: SpecArtifact | null,
  enabled: boolean,
): artifact is SpecArtifact &
  Readonly<{
    fileKey: SpecFileKey;
    format: "markdown";
    error: null;
    contents: string;
  }> {
  return (
    enabled &&
    bundleState.status === "ready" &&
    artifact !== null &&
    artifact.fileKey !== null &&
    artifact.format === "markdown" &&
    artifact.error === null &&
    artifact.contents !== null &&
    artifact.contents.trim().length > 0
  );
}
