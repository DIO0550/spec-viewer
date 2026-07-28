import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useRef,
} from "react";

import type { ViewMode } from "@/features/workspace/types/viewMode";

export type ViewModeToolbarProps = Readonly<{
  mode: ViewMode;
  activeItemLabel: string;
  modeControls?: Readonly<Partial<Record<ViewMode, ReactNode>>>;
  onModeChange: (mode: ViewMode) => void;
}>;

const Modes: readonly ViewMode[] = ["specs", "diff"];

/**
 * Switches Specs and Diff while exposing mode-specific controls.
 *
 * @param props - Controlled mode, label, controls and change callback.
 * @returns The accessible view-mode toolbar.
 */
export function ViewModeToolbar(props: ViewModeToolbarProps): ReactElement {
  const { mode, activeItemLabel, modeControls, onModeChange } = props;
  const tabRefs = useRef(new Map<ViewMode, HTMLButtonElement>());

  const selectMode = (nextMode: ViewMode): void => {
    onModeChange(nextMode);
    tabRefs.current.get(nextMode)?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: ViewMode,
  ): void => {
    const currentIndex = Modes.indexOf(currentMode);
    let nextMode: ViewMode | undefined;

    if (event.key === "ArrowRight") {
      nextMode = Modes[(currentIndex + 1) % Modes.length];
    } else if (event.key === "ArrowLeft") {
      nextMode = Modes[(currentIndex - 1 + Modes.length) % Modes.length];
    } else if (event.key === "Home") {
      nextMode = Modes[0];
    } else if (event.key === "End") {
      nextMode = Modes[Modes.length - 1];
    }

    if (nextMode === undefined) {
      return;
    }

    event.preventDefault();
    selectMode(nextMode);
  };

  return (
    <div className="view-mode-toolbar">
      <div className="segmented-control" role="tablist" aria-label="表示モード">
        {Modes.map((candidate) => (
          <button
            key={candidate}
            ref={(element) => {
              if (element === null) {
                tabRefs.current.delete(candidate);
              } else {
                tabRefs.current.set(candidate, element);
              }
            }}
            type="button"
            role="tab"
            id={`view-mode-${candidate}`}
            aria-selected={mode === candidate}
            tabIndex={mode === candidate ? 0 : -1}
            onClick={() => {
              selectMode(candidate);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, candidate);
            }}
          >
            {candidate === "specs" ? "Specs" : "Diff"}
          </button>
        ))}
      </div>
      <span className="view-mode-toolbar__item">{activeItemLabel}</span>
      <div className="view-mode-toolbar__controls">
        {modeControls?.[mode] ?? null}
      </div>
    </div>
  );
}
