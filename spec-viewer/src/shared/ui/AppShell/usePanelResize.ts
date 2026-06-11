import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useRef,
} from "react";

import { PanelResize, type PanelSide } from "./panelResize";

type UsePanelResizeOptions = Readonly<{
  side: PanelSide;
  width: number;
  minWidth: number;
  maxWidth: number;
  bodyRef: RefObject<HTMLDivElement | null>;
  onWidthChange?: (width: number) => void;
}>;

export type UsePanelResizeResult = Readonly<{
  /** @param event - Pointer-down event on the resize separator */
  startResize: (event: PointerEvent<HTMLButtonElement>) => void;
  /** @param event - Pointer-move event while resizing */
  continueResize: (event: PointerEvent<HTMLButtonElement>) => void;
  /** @param event - Pointer-up or cancel event ending the resize */
  stopResize: (event: PointerEvent<HTMLButtonElement>) => void;
  /** Ends the resize when pointer capture is lost. */
  releaseResize: () => void;
  /** @param event - Keydown event on the resize separator */
  resizeWithKeyboard: (event: KeyboardEvent<HTMLButtonElement>) => void;
}>;

/**
 * Wires pointer and keyboard resizing for one shell side panel.
 *
 * @param options - Panel side, width constraints, shell body ref, and callback.
 * @returns Resize separator event handlers for the panel.
 */
export function usePanelResize({
  side,
  width,
  minWidth,
  maxWidth,
  bodyRef,
  onWidthChange,
}: UsePanelResizeOptions): UsePanelResizeResult {
  const isResizingRef = useRef(false);

  const resizeFromPointer = (clientX: number): void => {
    const body = bodyRef.current;

    if (body === null || onWidthChange === undefined) {
      return;
    }

    const bodyRect = body.getBoundingClientRect();

    onWidthChange(
      PanelResize.widthFromPointer({
        side,
        bodyRect: { left: bodyRect.left, right: bodyRect.right },
        clientX,
      }),
    );
  };

  const startResize = (event: PointerEvent<HTMLButtonElement>): void => {
    if (onWidthChange === undefined) {
      return;
    }

    event.preventDefault();
    isResizingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeFromPointer(event.clientX);
  };

  const continueResize = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!isResizingRef.current) {
      return;
    }

    event.preventDefault();
    resizeFromPointer(event.clientX);
  };

  const stopResize = (event: PointerEvent<HTMLButtonElement>): void => {
    isResizingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const releaseResize = (): void => {
    isResizingRef.current = false;
  };

  const resizeWithKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (onWidthChange === undefined) {
      return;
    }

    const nextWidth = PanelResize.widthFromKeyboard({
      side,
      key: event.key,
      currentWidth: width,
      minWidth,
      maxWidth,
    });

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    onWidthChange(nextWidth);
  };

  return {
    startResize,
    continueResize,
    stopResize,
    releaseResize,
    resizeWithKeyboard,
  };
}
