import type { ReactElement } from "react";

export type ReviewMode = "specs" | "diff";

type Props = Readonly<{
  mode: ReviewMode;
  filePath: string;
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
  filePath,
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
          onClick={() => {
            onModeChange("diff");
          }}
        >
          Diff
        </button>
      </div>
      <div className="review-mode-toolbar__file">
        <span>{isDiffMode ? "src/scorer.ts" : filePath}</span>
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
