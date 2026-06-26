import { useEffect } from "react";

type KeyboardShortcutOptions = Readonly<{
  onNextFile: () => boolean;
  onPreviousFile: () => boolean;
  onNextComment: () => boolean;
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

function preventDefaultWhenHandled(
  event: KeyboardEvent,
  handleShortcut: () => boolean,
): void {
  if (handleShortcut()) {
    event.preventDefault();
  }
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
