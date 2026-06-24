import { useEffect } from "react";

type KeyboardShortcutOptions = Readonly<{
  isEnabled: boolean;
  isFileNavigationEnabled?: boolean;
  isCommentNavigationEnabled?: boolean;
  onNextFile: () => void;
  onPreviousFile: () => void;
  onNextComment: () => void;
  onPreviousComment: () => void;
}>;

/** Registers app-level keyboard shortcuts that avoid editable controls. */
export function useKeyboardShortcuts({
  isEnabled,
  isFileNavigationEnabled = isEnabled,
  isCommentNavigationEnabled = isEnabled,
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

      if (event.key === "ArrowRight" && isFileNavigationEnabled) {
        event.preventDefault();
        onNextFile();
        return;
      }

      if (event.key === "ArrowLeft" && isFileNavigationEnabled) {
        event.preventDefault();
        onPreviousFile();
        return;
      }

      if (event.key === "ArrowDown" && isCommentNavigationEnabled) {
        event.preventDefault();
        onNextComment();
        return;
      }

      if (event.key === "ArrowUp" && isCommentNavigationEnabled) {
        event.preventDefault();
        onPreviousComment();
      }
    };

    document.addEventListener("keydown", keydown);

    return () => {
      document.removeEventListener("keydown", keydown);
    };
  }, [
    isCommentNavigationEnabled,
    isEnabled,
    isFileNavigationEnabled,
    onNextComment,
    onNextFile,
    onPreviousComment,
    onPreviousFile,
  ]);
}

/** @returns True when the key event belongs to text entry or native controls. */
function shouldIgnoreKeyboardShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveElement = target.closest(
    'input, textarea, select, [contenteditable="true"]',
  );

  return interactiveElement !== null;
}
