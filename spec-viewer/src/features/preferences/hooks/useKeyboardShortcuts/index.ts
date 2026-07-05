import { useEffect } from "react";

type KeyboardShortcutOptions = Readonly<{
  /** Moves to the next file; returns true when handled. */
  onNextFile: () => boolean;
  /** Moves to the previous file; returns true when handled. */
  onPreviousFile: () => boolean;
  /** Moves to the next comment; returns true when handled. */
  onNextComment: () => boolean;
  /** Moves to the previous comment; returns true when handled. */
  onPreviousComment: () => boolean;
}>;

/** Registers app-level keyboard shortcuts that avoid editable controls. */
export function useKeyboardShortcuts({
  onNextFile,
  onPreviousFile,
  onNextComment,
  onPreviousComment,
}: KeyboardShortcutOptions): void {
  useEffect(() => {
    const keydown = (event: KeyboardEvent): void => {
      if (!event.altKey || shouldIgnoreKeyboardShortcut(event.target)) {
        return;
      }

      if (event.key === "ArrowRight") {
        preventDefaultWhenHandled(event, onNextFile);
        return;
      }

      if (event.key === "ArrowLeft") {
        preventDefaultWhenHandled(event, onPreviousFile);
        return;
      }

      if (event.key === "ArrowDown") {
        preventDefaultWhenHandled(event, onNextComment);
        return;
      }

      if (event.key === "ArrowUp") {
        preventDefaultWhenHandled(event, onPreviousComment);
      }
    };

    document.addEventListener("keydown", keydown);

    return () => {
      document.removeEventListener("keydown", keydown);
    };
  }, [onNextComment, onNextFile, onPreviousComment, onPreviousFile]);
}

/**
 * Prevents the event default only when the shortcut handler reports it handled.
 * @param event - The keyboard event to potentially prevent.
 * @param handleShortcut - Handler returning true when the shortcut was handled.
 */
function preventDefaultWhenHandled(
  event: KeyboardEvent,
  /** Handler returning true when the shortcut was handled. */
  handleShortcut: () => boolean,
): void {
  if (handleShortcut()) {
    event.preventDefault();
  }
}

/**
 * @param target - The event target that received the key event.
 * @returns True when the key event belongs to text entry or native controls.
 */
function shouldIgnoreKeyboardShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveElement = target.closest(
    'input, textarea, select, [contenteditable="true"]',
  );

  return interactiveElement !== null;
}
