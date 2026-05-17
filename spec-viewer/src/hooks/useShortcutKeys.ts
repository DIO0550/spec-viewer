import { type KeyboardEvent, useCallback } from "react";

export type ShortcutModifier = "ctrl" | "meta" | "ctrlOrMeta" | "alt" | "shift";

export type ShortcutKeyBinding<TElement extends HTMLElement> = Readonly<{
  key: string;
  modifiers?: readonly ShortcutModifier[];
  isEnabled?: boolean;
  preventDefault?: boolean;
  respectDefaultPrevented?: boolean;
  onMatch: (event: KeyboardEvent<TElement>) => void | Promise<void>;
}>;

export type UseShortcutKeysOptions<TElement extends HTMLElement> = Readonly<{
  shortcuts: readonly ShortcutKeyBinding<TElement>[];
}>;

export type UseShortcutKeysResult<TElement extends HTMLElement> = Readonly<{
  handleKeyDown: (event: KeyboardEvent<TElement>) => void;
}>;

/** @returns A React keydown handler that runs the first matching shortcut. */
export function useShortcutKeys<TElement extends HTMLElement>({
  shortcuts,
}: UseShortcutKeysOptions<TElement>): UseShortcutKeysResult<TElement> {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<TElement>): void => {
      const matchedShortcut = shortcuts.find((shortcut) =>
        matchesShortcut(event, shortcut),
      );

      if (matchedShortcut === undefined) {
        return;
      }

      if (matchedShortcut.preventDefault === true) {
        event.preventDefault();
      }

      void matchedShortcut.onMatch(event);
    },
    [shortcuts],
  );

  return { handleKeyDown };
}

function matchesShortcut<TElement extends HTMLElement>(
  event: KeyboardEvent<TElement>,
  shortcut: ShortcutKeyBinding<TElement>,
): boolean {
  if (shortcut.isEnabled === false) {
    return false;
  }

  if (shortcut.respectDefaultPrevented !== false && event.defaultPrevented) {
    return false;
  }

  if (event.key !== shortcut.key) {
    return false;
  }

  return matchesModifiers(event, shortcut.modifiers ?? []);
}

function matchesModifiers<TElement extends HTMLElement>(
  event: KeyboardEvent<TElement>,
  modifiers: readonly ShortcutModifier[],
): boolean {
  return modifiers.every((modifier) => matchesModifier(event, modifier));
}

function matchesModifier<TElement extends HTMLElement>(
  event: KeyboardEvent<TElement>,
  modifier: ShortcutModifier,
): boolean {
  if (modifier === "ctrlOrMeta") {
    return event.ctrlKey || event.metaKey;
  }

  if (modifier === "ctrl") {
    return event.ctrlKey;
  }

  if (modifier === "meta") {
    return event.metaKey;
  }

  if (modifier === "alt") {
    return event.altKey;
  }

  return event.shiftKey;
}
