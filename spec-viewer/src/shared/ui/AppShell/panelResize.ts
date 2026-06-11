export type PanelSide = "left" | "right";

const KEYBOARD_RESIZE_STEP = 16;

export const PanelResize = {
  /**
   * @param input - Panel side, shell body bounds, and pointer position
   * @returns The next panel width derived from the pointer position.
   */
  widthFromPointer({
    side,
    bodyRect,
    clientX,
  }: Readonly<{
    side: PanelSide;
    bodyRect: Readonly<{ left: number; right: number }>;
    clientX: number;
  }>): number {
    if (side === "left") {
      return clientX - bodyRect.left;
    }

    return bodyRect.right - clientX;
  },
  /**
   * @param input - Panel side, pressed key, and current width constraints
   * @returns The next panel width for the pressed key, or null when unhandled.
   */
  widthFromKeyboard({
    side,
    key,
    currentWidth,
    minWidth,
    maxWidth,
  }: Readonly<{
    side: PanelSide;
    key: string;
    currentWidth: number;
    minWidth: number;
    maxWidth: number;
  }>): number | null {
    const growKey = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrinkKey = side === "left" ? "ArrowLeft" : "ArrowRight";

    if (key === growKey) {
      return currentWidth + KEYBOARD_RESIZE_STEP;
    }

    if (key === shrinkKey) {
      return currentWidth - KEYBOARD_RESIZE_STEP;
    }

    if (key === "Home") {
      return minWidth;
    }

    if (key === "End") {
      return maxWidth;
    }

    return null;
  },
} as const;
