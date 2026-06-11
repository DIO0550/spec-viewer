import { useEffect } from "react";

type KeyboardShortcutOptions = Readonly<{
  isEnabled: boolean;
  /** Moves the selection to the next file. */
  onNextFile: () => void;
  /** Moves the selection to the previous file. */
  onPreviousFile: () => void;
  /** Moves the selection to the next comment. */
  onNextComment: () => void;
  /** Moves the selection to the previous comment. */
  onPreviousComment: () => void;
}>;

/** Registers app-level keyboard shortcuts that avoid editable controls. */
export function useKeyboardShortcuts({
  isEnabled,
  onNextFile,
  onPreviousFile,
  onNextComment,
  onPreviousComment,
}: KeyboardShortcutOptions): void {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const keydown = (event: KeyboardEvent): void => {
      if (!event.altKey || shouldIgnoreKeyboardShortcut(event.target)) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNextFile();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPreviousFile();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        onNextComment();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        onPreviousComment();
      }
    };

    document.addEventListener("keydown", keydown);

    return () => {
      document.removeEventListener("keydown", keydown);
    };
  }, [isEnabled, onNextComment, onNextFile, onPreviousComment, onPreviousFile]);
}

/**
 * @param target - Event target of the keyboard event
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
