import { type KeyboardEvent, useRef } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SpecArtifact } from "@/features/specs/domain/specArtifact";
import type {
  SpecArtifactIdentity,
  SpecArtifact as SpecArtifactType,
  SpecProgress,
} from "@/features/specs/types/spec";

type Props = Readonly<{
  specLabel: string | null;
  artifacts: readonly SpecArtifactType[];
  selectedIdentity: SpecArtifactIdentity | null;
  isSelectionDisabled?: boolean;
  /**
   * Selects an artifact tab.
   * @param identity - The identity of the artifact to select.
   */
  onSelectArtifact: (identity: SpecArtifactIdentity) => void;
}>;

const progressLabels: Readonly<Record<SpecProgress, string>> = {
  notStarted: "Not started",
  inProgress: "In progress",
  completed: "Completed",
  unknown: "Unknown",
};

/**
 * @param progress - The artifact's progress state.
 * @returns Human-readable label text for the given progress state.
 */
export function progressLabel(progress: SpecProgress): string {
  return progressLabels[progress];
}

/** Present-only artifact tabs with visible progress and roving keyboard focus. */
export function SpecArtifactTabs({
  specLabel,
  artifacts,
  selectedIdentity,
  isSelectionDisabled = false,
  onSelectArtifact,
}: Props) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedId =
    selectedIdentity === null ? null : SpecArtifact.stableId(selectedIdentity);

  if (specLabel === null) {
    return (
      <EmptyState
        title="Select a spec"
        description="Choose a spec from the tree to see its files."
        variant="inline"
      />
    );
  }

  if (artifacts.length === 0 && isSelectionDisabled) {
    return (
      <EmptyState
        title="Loading…"
        description="Loading spec artifacts…"
        variant="inline"
      />
    );
  }

  if (artifacts.length === 0) {
    return (
      <EmptyState
        title="No artifacts"
        description="This spec has no Markdown artifacts to display."
        variant="inline"
      />
    );
  }

  const selectAt = (index: number): void => {
    const artifact = artifacts[index];
    if (artifact === undefined || isSelectionDisabled) {
      return;
    }

    tabRefs.current[index]?.focus();
    onSelectArtifact(artifact.identity);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectAt((index + 1) % artifacts.length);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectAt((index - 1 + artifacts.length) % artifacts.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectAt(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectAt(artifacts.length - 1);
    }
  };

  return (
    <div
      className="spec-tabs"
      role="tablist"
      aria-label={`${specLabel} artifacts`}
    >
      {artifacts.map((artifact, index) => {
        const stableId = SpecArtifact.stableId(artifact.identity);
        const isSelected = selectedId === stableId;
        const progress = progressLabel(artifact.progress);
        const hasError = artifact.error !== null;
        const errorLabel = hasError ? ", read error" : "";

        return (
          <button
            key={stableId}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            className="spec-tabs__tab"
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-label={`${artifact.label}, ${progress}${errorLabel}`}
            aria-controls="markdown-viewer-panel"
            tabIndex={isSelected ? 0 : -1}
            title={
              artifact.error === null
                ? `${artifact.fileName} · ${progress}`
                : `${artifact.fileName} · ${artifact.error.message}`
            }
            disabled={isSelectionDisabled}
            onClick={() => onSelectArtifact(artifact.identity)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className="spec-tabs__label">{artifact.label}</span>
            <span className="spec-tabs__progress-text">{progress}</span>
            <span
              className={`spec-progress spec-progress--${artifact.progress}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
