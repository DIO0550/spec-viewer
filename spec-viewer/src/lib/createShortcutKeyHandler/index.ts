import type { KeyboardEvent } from "react";

export type ShortcutModifier = "ctrl" | "meta" | "ctrlOrMeta" | "alt" | "shift";

export type ShortcutKeyBinding<TElement extends HTMLElement> = Readonly<{
  key: string;
  modifiers?: readonly ShortcutModifier[];
  allowsAdditionalModifiers?: boolean;
  isEnabled?: boolean;
  preventDefault?: boolean;
  respectDefaultPrevented?: boolean;
  /**
   * Invoked when the shortcut matches.
   * @param event - The keyboard event that matched the shortcut.
   */
  onMatch: (event: KeyboardEvent<TElement>) => void;
}>;

export type CreateShortcutKeyHandlerOptions<TElement extends HTMLElement> =
  Readonly<{
    shortcuts: readonly ShortcutKeyBinding<TElement>[];
  }>;

/** @returns A keydown handler that runs the first matching shortcut. */
export function createShortcutKeyHandler<TElement extends HTMLElement>({
  shortcuts,
}: CreateShortcutKeyHandlerOptions<TElement>): (
  event: KeyboardEvent<TElement>,
) => void {
  return (event: KeyboardEvent<TElement>): void => {
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
}

/**
 * @param event - The keyboard event to test.
 * @param shortcut - The shortcut binding to match against.
 * @returns Whether the event matches the shortcut's key, modifiers and enabled state.
 */
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

/**
 * @param event - The keyboard event to inspect.
 * @param modifiers - The modifiers the shortcut requires.
 * @param allowsAdditionalModifiers - Whether modifiers beyond the required ones are tolerated.
 * @returns Whether the event's modifier keys satisfy the shortcut's modifier requirements.
 */
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

/**
 * @param event - The keyboard event to inspect.
 * @param modifier - The single modifier to test for.
 * @returns Whether the given modifier key is currently pressed in the event.
 */
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

/**
 * @param modifier - The concrete modifier key whose pressed state is evaluated.
 * @param modifiers - The modifiers the shortcut requires.
 * @param isPressed - Whether the modifier key is pressed in the event.
 * @returns Whether the pressed state of the modifier is permitted by the shortcut.
 */
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
