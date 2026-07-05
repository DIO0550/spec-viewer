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
   * Invoked when this shortcut matches the keyboard event.
   * @param event - The matching keyboard event.
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
 * Determines whether a keyboard event satisfies a shortcut binding.
 * @param event - The keyboard event to test.
 * @param shortcut - The shortcut binding to match against.
 * @returns True when the event matches the shortcut.
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
 * Checks that the event's modifier keys match the required modifiers.
 * @param input - Event, required modifiers, and extra-modifier policy.
 * @returns True when the modifier state satisfies the requirements.
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
 * Tests whether a single modifier is active for the event.
 * @param event - The keyboard event to inspect.
 * @param modifier - The modifier to check.
 * @returns True when the modifier is active.
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
 * Decides whether a pressed modifier is permitted by the binding.
 * @param modifier - The concrete modifier being evaluated.
 * @param modifiers - The modifiers required by the shortcut.
 * @param isPressed - Whether the modifier is currently pressed.
 * @returns True when the modifier state is allowed.
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
