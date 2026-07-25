import type { ReactElement } from "react";

export type ReviewMode = "specs" | "diff";

type Props = Readonly<{
  mode: ReviewMode;
  fileLabel: string;
  onModeChange: (mode: ReviewMode) => void;
}>;

/**
 * Displays the Specs/Diff mode switch and the mode-specific display controls.
 *
 * @param props - Current mode, selected path and mode-change callback.
 * @returns The review mode toolbar.
 */
export function ReviewModeToolbar({
  mode,
  fileLabel,
  onModeChange,
}: Props): ReactElement {
  const isDiffMode = mode === "diff";

  return (
    <div className="review-mode-toolbar">
      <div className="segmented-control" role="tablist" aria-label="表示モード">
        <button
          type="button"
          role="tab"
          aria-selected={!isDiffMode}
          tabIndex={isDiffMode ? -1 : 0}
          onClick={() => {
            onModeChange("specs");
          }}
        >
          Specs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isDiffMode}
          tabIndex={isDiffMode ? 0 : -1}
          onClick={() => {
            onModeChange("diff");
          }}
        >
          Diff
        </button>
      </div>
      <div className="review-mode-toolbar__file">
        <span>{isDiffMode ? "src/scorer.ts" : fileLabel}</span>
        {isDiffMode ? (
          <span
            className="diff-stat-group"
            aria-label="12 additions, 4 deletions"
          >
            <span className="diff-stat diff-stat--added">+12</span>
            <span className="diff-stat diff-stat--removed">−4</span>
          </span>
        ) : null}
      </div>
      <div
        className="segmented-control review-mode-toolbar__views"
        aria-hidden={!isDiffMode}
      >
        <button type="button" aria-pressed={isDiffMode}>
          Unified
        </button>
        <button type="button" aria-pressed="false">
          Split
        </button>
        <button type="button" aria-pressed="false">
          Editor
        </button>
      </div>
    </div>
  );
}
