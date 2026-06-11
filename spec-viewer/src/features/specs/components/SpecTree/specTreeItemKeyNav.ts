import type { KeyboardEvent } from "react";

import { SpecTreeKeyNav } from "@/features/specs/domain/specTreeKeyNav";

type TreeItemKeyDownOptions = Readonly<{
  hasChildren: boolean;
  isExpanded: boolean;
  /** Toggles the expansion state of the focused item. */
  onToggleExpanded: () => void;
}>;

/**
 * Moves focus between visible tree items for arrow-key navigation.
 *
 * @param event - Keydown event from a tree item button.
 * @param options - Expansion state and toggle callback for the focused item.
 */
export function handleTreeItemKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  options: TreeItemKeyDownOptions,
): void {
  if (
    SpecTreeKeyNav.shouldToggleExpansion({
      key: event.key,
      hasChildren: options.hasChildren,
      isExpanded: options.isExpanded,
    })
  ) {
    event.preventDefault();
    options.onToggleExpanded();
    return;
  }

  const items = collectVisibleTreeItems(event);
  const nextIndex = SpecTreeKeyNav.nextIndex({
    key: event.key,
    levels: items.map(readTreeItemLevel),
    currentIndex: items.indexOf(event.currentTarget),
  });

  if (nextIndex === null) {
    return;
  }

  const nextItem = items[nextIndex];

  if (nextItem === undefined) {
    return;
  }

  event.preventDefault();
  nextItem.focus();
}

/**
 * @param event - Keydown event from a tree item button.
 * @returns All visible tree item buttons in document order.
 */
function collectVisibleTreeItems(
  event: KeyboardEvent<HTMLButtonElement>,
): readonly HTMLButtonElement[] {
  const tree = event.currentTarget.closest('[role="tree"]');

  return Array.from(
    tree?.querySelectorAll<HTMLButtonElement>(".spec-tree__item") ?? [],
  );
}

/**
 * @param item - Rendered tree item button.
 * @returns The aria tree level for a rendered tree item.
 */
function readTreeItemLevel(item: HTMLButtonElement): number {
  const level = Number(item.getAttribute("aria-level"));

  return Number.isFinite(level) ? level : 1;
}
