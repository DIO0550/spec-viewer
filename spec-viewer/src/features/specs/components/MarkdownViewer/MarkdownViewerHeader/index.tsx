import { RefreshCcw } from "lucide-react";

import type { SpecFileKey } from "@/shared/domain/specFileKey";
import { uiText } from "@/shared/lib/uiText";
import {
  DocumentSearchControl,
  type DocumentSearchControlProps,
} from "./DocumentSearchControl";
import { HtmlZoomControl, type HtmlZoomControlProps } from "./HtmlZoomControl";

export type MarkdownViewerHeaderProps = Readonly<{
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  fileKey: SpecFileKey;
  path: string;
  htmlZoom: HtmlZoomControlProps | null;
  documentSearch: DocumentSearchControlProps;
  /** Reloads the current spec document. */
  onReload: () => void;
}>;

/** @returns The Markdown viewer document header and action controls. */
export function MarkdownViewerHeader({
  selectedSpecLabel,
  selectedFileLabel,
  fileKey,
  path,
  htmlZoom,
  documentSearch,
  onReload,
}: MarkdownViewerHeaderProps) {
  return (
    <header className="markdown-viewer__header">
      <div>
        <p className="markdown-viewer__eyebrow">{selectedSpecLabel}</p>
        <h1>{selectedFileLabel ?? fileKey}</h1>
        <p className="markdown-viewer__path">{path}</p>
      </div>
      <div className="markdown-viewer__actions">
        {htmlZoom === null ? null : <HtmlZoomControl {...htmlZoom} />}
        <DocumentSearchControl {...documentSearch} />
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.markdown.reload}
          title={uiText.markdown.reload}
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </div>
    </header>
  );
}
