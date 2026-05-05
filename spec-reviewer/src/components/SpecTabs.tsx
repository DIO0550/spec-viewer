import { type KeyboardEvent, useRef } from "react";

import type { SpecFileKey, SpecNode } from "../types/spec";
import { EmptyState } from "./EmptyState";

type Props = Readonly<{
  spec: SpecNode | null;
  selectedFileKey: SpecFileKey | null;
  onSelectFile: (fileKey: SpecFileKey) => void;
}>;

/** @returns File tabs for the selected spec. */
export function SpecTabs({ spec, selectedFileKey, onSelectFile }: Props) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  const selectTabAt = (index: number): void => {
    const file = spec.files[index];

    if (file === undefined) {
      return;
    }

    tabRefs.current[index]?.focus();
    onSelectFile(file.key);
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTabAt((index + 1) % spec.files.length);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTabAt((index - 1 + spec.files.length) % spec.files.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectTabAt(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectTabAt(spec.files.length - 1);
    }
  };

  return (
    <div
      className="spec-tabs"
      role="tablist"
      aria-label={`${spec.label} files`}
    >
      {spec.files.map((file, index) => {
        const isSelected = selectedFileKey === file.key;
        const sourceLabel = configSourceLabel(file.configSource);
        const title = `${file.fileName} from ${sourceLabel}`;

        return (
          <button
            key={file.key}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            className="spec-tabs__tab"
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-label={`${file.label}, ${file.status}, ${title}`}
            aria-controls="markdown-viewer-panel"
            tabIndex={isSelected ? 0 : -1}
            title={title}
            onClick={() => {
              onSelectFile(file.key);
            }}
            onKeyDown={(event) => {
              handleTabKeyDown(event, index);
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

/** @returns Human-readable config source text for tab debug affordances. */
function configSourceLabel(
  source: SpecNode["files"][number]["configSource"],
): string {
  if (source === "specOverride") {
    return "spec override";
  }

  if (source === "workspaceConfig") {
    return "workspace config";
  }

  return "defaults";
}
