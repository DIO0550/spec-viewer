import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useRef,
} from "react";

import type { ViewMode } from "@/features/workspace/types/viewMode";

export type ViewModeDiffAvailability =
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export type ViewModeToolbarProps = Readonly<{
  mode: ViewMode;
  activeItemLabel: string;
  diffAvailability?: ViewModeDiffAvailability;
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
  const {
    mode,
    activeItemLabel,
    diffAvailability = { status: "ready" },
    modeControls,
    onModeChange,
  } = props;
  const tabRefs = useRef(new Map<ViewMode, HTMLButtonElement>());

  const isModeAvailable = (candidate: ViewMode): boolean =>
    candidate === "specs" || diffAvailability.status === "ready";
  const selectedMode = isModeAvailable(mode) ? mode : "specs";

  const selectMode = (nextMode: ViewMode): void => {
    if (!isModeAvailable(nextMode) || nextMode === mode) {
      return;
    }

    onModeChange(nextMode);
    tabRefs.current.get(nextMode)?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: ViewMode,
  ): void => {
    const availableModes = Modes.filter(isModeAvailable);
    const currentIndex = availableModes.indexOf(currentMode);
    let nextMode: ViewMode | undefined;

    if (event.key === "ArrowRight") {
      nextMode = availableModes[(currentIndex + 1) % availableModes.length];
    } else if (event.key === "ArrowLeft") {
      nextMode =
        availableModes[
          (currentIndex - 1 + availableModes.length) % availableModes.length
        ];
    } else if (event.key === "Home") {
      nextMode = availableModes[0];
    } else if (event.key === "End") {
      nextMode = availableModes[availableModes.length - 1];
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
            aria-selected={selectedMode === candidate}
            aria-disabled={!isModeAvailable(candidate) || undefined}
            title={
              candidate === "diff" && diffAvailability.status === "unavailable"
                ? diffAvailability.reason
                : undefined
            }
            tabIndex={selectedMode === candidate ? 0 : -1}
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
