import { EmptyState } from "@/components/EmptyState";
import { MarkdownViewer } from "@/features/specs/components/MarkdownViewer";
import type { RenderedDocumentPort } from "@/features/specs/components/MarkdownViewer/renderedDocument";
import type { SpecBundleState } from "@/features/specs/domain/specBundleState";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecArtifact } from "@/features/specs/types/spec";

export type SpecArtifactViewerProps = Readonly<{
  bundleState: SpecBundleState;
  artifact: SpecArtifact | null;
  workspacePath: string | null;
  selectedSpecLabel: string | null;
  renderedDocumentPort?: RenderedDocumentPort;
  onReload: () => void;
  onFirstReadable?: () => void;
}>;

/**
 * Placeholder file key used only to satisfy the `SpecFileKey`-typed
 * `SpecDocumentState` shape for direct Markdown artifacts. It is inert:
 * App composition never attaches an interaction port to direct artifacts, so
 * this key cannot escape into persistence. Standard artifacts always carry their real key.
 */
const DIRECT_ARTIFACT_PLACEHOLDER_KEY = "impl" as const;

/**
 * Adapts bundle artifacts to the established secure Markdown renderer.
 *
 * @param props - Bundle state, the selected artifact, workspace path, and the
 *   Markdown viewer callbacks/comment props forwarded to `MarkdownViewer`.
 * @returns The stable tabpanel for the selected artifact, or a status panel for
 *   loading/error/empty/read-error states.
 */
export function SpecArtifactViewer({
  bundleState,
  artifact,
  workspacePath,
  selectedSpecLabel,
  onReload,
  ...viewerProps
}: SpecArtifactViewerProps) {
  if (bundleState.status === "loading") {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer__status"
        role="tabpanel"
        tabIndex={-1}
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
        role="tabpanel"
        tabIndex={-1}
      >
        <div role="alert">
          <h2>Unable to load spec artifacts</h2>
          <p>{bundleState.error.message}</p>
          <button type="button" onClick={onReload}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (bundleState.status === "empty" || artifact === null) {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer__status"
        role="tabpanel"
        tabIndex={-1}
      >
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
        role="tabpanel"
        tabIndex={-1}
      >
        <div role="alert">
          <h2>Unable to read {artifact.label}</h2>
          <p>
            {artifact.error.code}: {artifact.error.message}
          </p>
          <p>Other artifact tabs remain available.</p>
          <button type="button" onClick={onReload}>
            Reload artifacts
          </button>
        </div>
      </section>
    );
  }

  const isStandardArtifact = artifact.fileKey !== null;
  const fileKey = artifact.fileKey ?? DIRECT_ARTIFACT_PLACEHOLDER_KEY;
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
        isStandardArtifact ? "Standard artifact" : "Direct Markdown"
      }
      onReload={onReload}
    />
  );
}
