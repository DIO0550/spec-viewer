import type { RefObject } from "react";

import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import { uiText } from "@/shared/lib/uiText";
import { CommandErrorDisplay } from "@/shared/ui/CommandErrorDisplay";
import { EmptyState } from "@/shared/ui/EmptyState";
import { LoadingSkeleton } from "@/shared/ui/LoadingSkeleton";

type Props = Readonly<{
  panelRef: RefObject<HTMLElement | null>;
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  /** Reloads the current document after a failure. */
  onReload: () => void;
}>;

/** @returns The Markdown viewer panel for idle, loading, error, missing, and empty documents. */
export function MarkdownViewerFallback({
  panelRef,
  state,
  selectedSpecLabel,
  onReload,
}: Props) {
  if (state.status === "idle") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState
          title={
            selectedSpecLabel === null
              ? uiText.markdown.chooseSpec
              : uiText.markdown.chooseFile
          }
          description={uiText.markdown.idleDescription}
        />
      </section>
    );
  }

  if (state.status === "loading") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer"
        role="tabpanel"
        aria-live="polite"
        tabIndex={-1}
      >
        <LoadingSkeleton
          className="markdown-loading-skeleton"
          label={uiText.markdown.loading}
          rows={[
            { width: "short" },
            { width: "long" },
            { width: "medium" },
            { width: "full" },
            { width: "full" },
            { width: "medium" },
            { width: "long" },
          ]}
        />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <CommandErrorDisplay
          title={uiText.markdown.loadError}
          error={state.error}
          actionLabel={uiText.sidebar.retry}
          onAction={onReload}
        />
      </section>
    );
  }

  if (state.status === "missing") {
    return (
      <section
        ref={panelRef}
        id="markdown-viewer-panel"
        className="markdown-viewer markdown-viewer--center"
        role="tabpanel"
        tabIndex={-1}
      >
        <EmptyState
          title={uiText.markdown.missingTitle}
          description={`${state.document.path} ${uiText.markdown.missingDescription}`}
        />
      </section>
    );
  }

  return (
    <section
      ref={panelRef}
      id="markdown-viewer-panel"
      className="markdown-viewer markdown-viewer--center"
      role="tabpanel"
      tabIndex={-1}
    >
      <EmptyState
        title={uiText.markdown.emptyTitle}
        description={state.document.path}
      />
    </section>
  );
}
