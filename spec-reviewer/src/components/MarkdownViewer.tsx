import { RefreshCcw } from "lucide-react";

import type { SpecDocumentState } from "../hooks/useSpecs";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

type Props = Readonly<{
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  onReload: () => void;
}>;

/** @returns The Markdown viewer shell with document loading states. */
export function MarkdownViewer({
  state,
  selectedSpecLabel,
  selectedFileLabel,
  onReload,
}: Props) {
  if (state.status === "idle") {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
      >
        <EmptyState
          title={selectedSpecLabel === null ? "Choose a spec" : "Choose a file"}
          description="Markdown rendering is reserved for the next viewer task."
        />
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        aria-live="polite"
      >
        <div className="viewer-loading" role="status">
          <span className="viewer-loading__indicator" aria-hidden="true" />
          <span>Loading Markdown...</span>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
      >
        <ErrorState
          title="Could not load Markdown"
          message={state.error.message}
          actionLabel="Retry"
          onAction={onReload}
        />
      </section>
    );
  }

  if (state.status === "missing") {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
      >
        <EmptyState
          title="File missing"
          description={`${state.document.path} is not available in this workspace.`}
        />
      </section>
    );
  }

  const contents = state.document.contents;

  if (contents === null || contents.trim().length === 0) {
    return (
      <section
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
      >
        <EmptyState title="File is empty" description={state.document.path} />
      </section>
    );
  }

  return (
    <article
      id="markdown-viewer-panel"
      className="markdown-viewer"
      role="tabpanel"
    >
      <header className="markdown-viewer__header">
        <div>
          <p className="markdown-viewer__eyebrow">{selectedSpecLabel}</p>
          <h1>{selectedFileLabel ?? state.fileKey}</h1>
          <p className="markdown-viewer__path">{state.document.path}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Reload Markdown"
          title="Reload Markdown"
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </header>
      <pre
        className="markdown-viewer__source"
        aria-label="Markdown source preview"
      >
        {contents}
      </pre>
    </article>
  );
}
