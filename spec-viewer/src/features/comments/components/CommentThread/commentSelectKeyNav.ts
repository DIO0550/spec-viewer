import type { KeyboardEvent } from "react";

/**
 * @param event - Keydown event from a comment select button.
 * @returns The adjacent comment select button for list keyboard navigation.
 */
export function findNextCommentSelectButton(
  event: KeyboardEvent<HTMLButtonElement>,
): HTMLButtonElement | null {
  const buttons = Array.from(
    event.currentTarget
      .closest(".comment-sidebar")
      ?.querySelectorAll<HTMLButtonElement>(".comment-thread__select") ?? [],
  );
  const currentIndex = buttons.indexOf(event.currentTarget);

  if (currentIndex < 0) {
    return null;
  }

  if (event.key === "ArrowDown") {
    return buttons[Math.min(currentIndex + 1, buttons.length - 1)] ?? null;
  }

  if (event.key === "ArrowUp") {
    return buttons[Math.max(currentIndex - 1, 0)] ?? null;
  }

  if (event.key === "Home") {
    return buttons[0] ?? null;
  }

  if (event.key === "End") {
    return buttons[buttons.length - 1] ?? null;
  }

  return null;
}
