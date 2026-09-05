import { type KeyboardEvent, type ReactElement, useRef } from "react";

import type { FileReviewViewMode } from "@/features/diff/domain/fileDiff";

export type DiffViewModeControlsProps = Readonly<{
  mode: FileReviewViewMode;
  disabled: boolean;
  onModeChange: (mode: FileReviewViewMode) => void;
}>;

const Modes: readonly FileReviewViewMode[] = ["unified", "split", "editor"];

const ModeLabels = {
  unified: "Unified",
  split: "Split",
  editor: "Editor",
} as const satisfies Record<FileReviewViewMode, string>;

/**
 * Renders the controlled file-view radiogroup used by the shared toolbar.
 *
 * @param props - Active mode, availability, and change callback.
 * @returns Accessible three-mode controls.
 */
export function DiffViewModeControls(
  props: DiffViewModeControlsProps,
): ReactElement {
  const buttonRefs = useRef(new Map<FileReviewViewMode, HTMLButtonElement>());

  const choose = (mode: FileReviewViewMode): void => {
    if (props.disabled) {
      return;
    }
    props.onModeChange(mode);
    buttonRefs.current.get(mode)?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: FileReviewViewMode,
  ): void => {
    const currentIndex = Modes.indexOf(currentMode);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % Modes.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + Modes.length) % Modes.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = Modes.length - 1;
    }
    if (nextIndex === null) {
      return;
    }

    const nextMode = Modes[nextIndex];
    if (nextMode === undefined) {
      return;
    }
    event.preventDefault();
    choose(nextMode);
  };

  return (
    <div
      className="diff-view-mode-controls"
      role="radiogroup"
      aria-label="ファイル表示形式"
    >
      {Modes.map((mode) => (
        <button
          key={mode}
          ref={(element) => {
            if (element === null) {
              buttonRefs.current.delete(mode);
            } else {
              buttonRefs.current.set(mode, element);
            }
          }}
          className="diff-view-mode-controls__button"
          type="button"
          role="radio"
          aria-checked={props.mode === mode}
          disabled={props.disabled}
          tabIndex={props.mode === mode ? 0 : -1}
          onClick={() => choose(mode)}
          onKeyDown={(event) => handleKeyDown(event, mode)}
        >
          {ModeLabels[mode]}
        </button>
      ))}
    </div>
  );
}
