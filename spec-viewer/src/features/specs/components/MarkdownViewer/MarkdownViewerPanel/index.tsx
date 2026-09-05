import type { ReactNode, RefObject } from "react";

export type MarkdownViewerPanelVariant = "default" | "center" | "html";

type MarkdownViewerPanelElement = "article" | "section";

export type MarkdownViewerPanelProps = Readonly<{
  panelRef: RefObject<HTMLElement | null>;
  as?: MarkdownViewerPanelElement;
  variant?: MarkdownViewerPanelVariant;
  ariaLive?: "polite";
  interactionOverlayOpen?: boolean;
  children: ReactNode;
}>;

/** @returns A stable tabpanel wrapper for Markdown viewer states. */
export function MarkdownViewerPanel({
  panelRef,
  as = "section",
  variant = "default",
  ariaLive,
  interactionOverlayOpen = false,
  children,
}: MarkdownViewerPanelProps) {
  const className = getMarkdownViewerPanelClassName(variant);
  const panelProps = {
    ref: panelRef,
    id: "markdown-viewer-panel",
    className,
    role: "tabpanel",
    "aria-live": ariaLive,
    "data-viewer-overlay-open": interactionOverlayOpen ? "true" : undefined,
    tabIndex: -1,
  } as const;

  if (as === "article") {
    return <article {...panelProps}>{children}</article>;
  }

  return <section {...panelProps}>{children}</section>;
}

/**
 * @param variant - Semantic panel display variant.
 * @returns Existing Markdown viewer CSS class names for the variant.
 */
function getMarkdownViewerPanelClassName(
  variant: MarkdownViewerPanelVariant,
): string {
  if (variant === "center") {
    return "markdown-viewer markdown-viewer--center";
  }

  if (variant === "html") {
    return "markdown-viewer markdown-viewer--html";
  }

  return "markdown-viewer";
}
