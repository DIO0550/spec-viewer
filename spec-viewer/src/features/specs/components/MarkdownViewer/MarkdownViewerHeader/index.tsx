import { RefreshCcw } from "lucide-react";

import type { SpecFileKey } from "@/features/specs/types/spec";
import { uiText } from "@/utils/uiText";
import {
  DocumentSearchControl,
  type DocumentSearchControlProps,
} from "./DocumentSearchControl";
import { HtmlZoomControl, type HtmlZoomControlProps } from "./HtmlZoomControl";

export type MarkdownViewerHeaderProps = Readonly<{
  selectedSpecLabel: string | null;
  selectedFileLabel: string | null;
  fileKey: SpecFileKey;
  fileTypeLabel?: string;
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
  fileTypeLabel,
  path,
  htmlZoom,
  documentSearch,
  onReload,
}: MarkdownViewerHeaderProps) {
  return (
    <header className="markdown-viewer__header">
      <div>
        <nav className="markdown-viewer__breadcrumb" aria-label="Breadcrumb">
          <span className="markdown-viewer__eyebrow">{selectedSpecLabel}</span>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{selectedFileLabel ?? fileKey}</span>
        </nav>
        <h1>{selectedFileLabel ?? fileKey}</h1>
        <p className="markdown-viewer__subtitle">
          {selectedSpecLabel} · {fileTypeLabel ?? fileKey}
        </p>
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
