import type { SpecFileKey, SpecNode } from "../types/spec";
import { EmptyState } from "./EmptyState";

type Props = Readonly<{
  spec: SpecNode | null;
  selectedFileKey: SpecFileKey | null;
  onSelectFile: (fileKey: SpecFileKey) => void;
}>;

/** @returns File tabs for the selected spec. */
export function SpecTabs({ spec, selectedFileKey, onSelectFile }: Props) {
  if (spec === null) {
    return (
      <EmptyState
        title="Select a spec"
        description="Choose a spec from the tree to see its files."
        variant="inline"
      />
    );
  }

  if (spec.files.length === 0) {
    return (
      <EmptyState
        title="No files configured"
        description="This spec has no configured Markdown files."
        variant="inline"
      />
    );
  }

  return (
    <div
      className="spec-tabs"
      role="tablist"
      aria-label={`${spec.label} files`}
    >
      {spec.files.map((file) => {
        const isSelected = selectedFileKey === file.key;

        return (
          <button
            key={file.key}
            className="spec-tabs__tab"
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls="markdown-viewer-panel"
            onClick={() => {
              onSelectFile(file.key);
            }}
          >
            <span>{file.label}</span>
            <span className={`file-status file-status--${file.status}`}>
              {file.status}
            </span>
          </button>
        );
      })}
    </div>
  );
}
