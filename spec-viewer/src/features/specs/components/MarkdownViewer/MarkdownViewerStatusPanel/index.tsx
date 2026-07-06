import type { RefObject } from "react";

import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import { uiText } from "@/shared/lib/uiText";
import { CommandErrorDisplay } from "@/shared/ui/CommandErrorDisplay";
import { EmptyState } from "@/shared/ui/EmptyState";
import { LoadingSkeleton } from "@/shared/ui/LoadingSkeleton";

import { MarkdownViewerPanel } from "../MarkdownViewerPanel";

const loadingSkeletonRows = [
  { width: "short" },
  { width: "long" },
  { width: "medium" },
  { width: "full" },
  { width: "full" },
  { width: "medium" },
  { width: "long" },
] as const;

export type MarkdownViewerStatusPanelProps = Readonly<{
  state: SpecDocumentState;
  selectedSpecLabel: string | null;
  panelRef: RefObject<HTMLElement | null>;
  /** Reloads the current spec document. */
  onReload: () => void;
}>;

/** @returns Status-specific Markdown viewer content in the stable tabpanel. */
export function MarkdownViewerStatusPanel({
  state,
  selectedSpecLabel,
  panelRef,
  onReload,
}: MarkdownViewerStatusPanelProps) {
  if (state.status === "idle") {
    return (
      <MarkdownViewerPanel panelRef={panelRef} variant="center">
        <EmptyState
          title={
            selectedSpecLabel === null
              ? uiText.markdown.chooseSpec
              : uiText.markdown.chooseFile
          }
          description={uiText.markdown.idleDescription}
        />
      </MarkdownViewerPanel>
    );
  }

  if (state.status === "loading") {
    return (
      <MarkdownViewerPanel panelRef={panelRef} ariaLive="polite">
        <LoadingSkeleton
          className="markdown-loading-skeleton"
          label={uiText.markdown.loading}
          rows={loadingSkeletonRows}
        />
      </MarkdownViewerPanel>
    );
  }

  if (state.status === "error") {
    return (
      <MarkdownViewerPanel panelRef={panelRef} variant="center">
        <CommandErrorDisplay
          title={uiText.markdown.loadError}
          error={state.error}
          actionLabel={uiText.sidebar.retry}
          onAction={onReload}
        />
      </MarkdownViewerPanel>
    );
  }

  if (state.status === "missing") {
    return (
      <MarkdownViewerPanel panelRef={panelRef} variant="center">
        <EmptyState
          title={uiText.markdown.missingTitle}
          description={`${state.document.path} ${uiText.markdown.missingDescription}`}
        />
      </MarkdownViewerPanel>
    );
  }

  if (
    state.document.contents === null ||
    state.document.contents.trim().length === 0
  ) {
    return (
      <MarkdownViewerPanel panelRef={panelRef} variant="center">
        <EmptyState
          title={uiText.markdown.emptyTitle}
          description={state.document.path}
        />
      </MarkdownViewerPanel>
    );
  }

  return null;
}
