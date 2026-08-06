import type { ComponentProps } from "react";

import type { SpecBundleState } from "@/features/specs/domain/specBundleState";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecArtifact } from "@/features/specs/types/spec";
import { EmptyState } from "@/components/EmptyState";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";

type MarkdownViewerProps = ComponentProps<typeof MarkdownViewer>;

type Props = Omit<MarkdownViewerProps, "state" | "selectedFileLabel"> &
  Readonly<{
    bundleState: SpecBundleState;
    artifact: SpecArtifact | null;
    workspacePath: string | null;
  }>;

/** Adapts bundle artifacts to the established secure Markdown renderer. */
export function SpecArtifactViewer({
  bundleState,
  artifact,
  workspacePath,
  selectedSpecLabel,
  onReload,
  ...viewerProps
}: Props) {
  if (bundleState.status === "loading") {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer__status"
        aria-live="polite"
      >
        <p>Loading spec artifacts…</p>
      </section>
    );
  }

  if (bundleState.status === "error") {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer__status"
        role="alert"
      >
        <h2>Unable to load spec artifacts</h2>
        <p>{bundleState.error.message}</p>
        <button type="button" onClick={onReload}>
          Retry
        </button>
      </section>
    );
  }

  if (bundleState.status === "empty" || artifact === null) {
    return (
      <section id="markdown-viewer-panel" className="markdown-viewer__status">
        <EmptyState
          title="No artifacts"
          description="This spec has no Markdown artifacts to display."
        />
      </section>
    );
  }

  if (artifact.error !== null) {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer__status"
        role="alert"
      >
        <h2>Unable to read {artifact.label}</h2>
        <p>
          {artifact.error.code}: {artifact.error.message}
        </p>
        <p>Other artifact tabs remain available.</p>
        <button type="button" onClick={onReload}>
          Reload artifacts
        </button>
      </section>
    );
  }

  const fileKey = artifact.fileKey ?? "impl";
  const state = SpecDocumentState.loaded(
    workspacePath ?? "",
    bundleState.bundle === null ? "" : bundleState.bundle.specId,
    fileKey,
    {
      key: fileKey,
      format: artifact.format,
      path: artifact.path,
      contents: artifact.contents,
      missing: false,
      blocks: artifact.blocks,
    },
  );

  return (
    <MarkdownViewer
      {...viewerProps}
      state={state}
      selectedSpecLabel={selectedSpecLabel}
      selectedFileLabel={artifact.label}
      selectedFileTypeLabel={
        artifact.identity.kind === "directMarkdown"
          ? "Direct Markdown"
          : "Standard artifact"
      }
      onReload={onReload}
    />
  );
}
