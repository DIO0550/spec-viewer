import { type KeyboardEvent } from "react";

export type ShortcutModifier = "ctrl" | "meta" | "ctrlOrMeta" | "alt" | "shift";

export type ShortcutKeyBinding<TElement extends HTMLElement> = Readonly<{
  key: string;
  modifiers?: readonly ShortcutModifier[];
  allowsAdditionalModifiers?: boolean;
  isEnabled?: boolean;
  preventDefault?: boolean;
  respectDefaultPrevented?: boolean;
  onMatch: (event: KeyboardEvent<TElement>) => void;
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
  const handleKeyDown = (event: KeyboardEvent<TElement>): void => {
    const matchedShortcut = shortcuts.find((shortcut) =>
      matchesShortcut(event, shortcut),
    );

    if (matchedShortcut === undefined) {
      return;
    }

    if (matchedShortcut.preventDefault === true) {
      event.preventDefault();
    }

    matchedShortcut.onMatch(event);
  };

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

  return matchesModifiers({
    event,
    modifiers: shortcut.modifiers ?? [],
    allowsAdditionalModifiers: shortcut.allowsAdditionalModifiers === true,
  });
}

type MatchesModifiersInput<TElement extends HTMLElement> = Readonly<{
  event: KeyboardEvent<TElement>;
  modifiers: readonly ShortcutModifier[];
  allowsAdditionalModifiers: boolean;
}>;

function matchesModifiers<TElement extends HTMLElement>({
  event,
  modifiers,
  allowsAdditionalModifiers,
}: MatchesModifiersInput<TElement>): boolean {
  if (!modifiers.every((modifier) => matchesModifier(event, modifier))) {
    return false;
  }

  if (allowsAdditionalModifiers) {
    return true;
  }

  const modifierStates = [
    { modifier: "ctrl", isPressed: event.ctrlKey },
    { modifier: "meta", isPressed: event.metaKey },
    { modifier: "alt", isPressed: event.altKey },
    { modifier: "shift", isPressed: event.shiftKey },
  ] as const;

  return modifierStates.every(({ modifier, isPressed }) =>
    isModifierAllowed(modifier, modifiers, isPressed),
  );
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

function isModifierAllowed(
  modifier: Exclude<ShortcutModifier, "ctrlOrMeta">,
  modifiers: readonly ShortcutModifier[],
  isPressed: boolean,
): boolean {
  if (!isPressed) {
    return true;
  }

  if (modifier === "ctrl" || modifier === "meta") {
    return modifiers.includes(modifier) || modifiers.includes("ctrlOrMeta");
  }

  return modifiers.includes(modifier);
}
