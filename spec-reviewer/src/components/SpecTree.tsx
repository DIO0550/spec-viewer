import type { KeyboardEvent } from "react";
import { RefreshCcw } from "lucide-react";

import type { SpecTreeState } from "../hooks/useSpecs";
import { uiText } from "../lib/uiText";
import type { SpecNode } from "../types/spec";
import { CommandErrorDisplay } from "./CommandErrorDisplay";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

const BASE_TREE_ITEM_INDENT = 10;
const TREE_ITEM_INDENT_STEP = 16;

type Props = Readonly<{
  state: SpecTreeState;
  selectedSpecId: string | null;
  onSelectSpec: (specId: string) => void;
  onReload: () => void;
}>;

/** @returns A navigable spec tree sidebar with loading, error, and empty states. */
export function SpecTree({
  state,
  selectedSpecId,
  onSelectSpec,
  onReload,
}: Props) {
  if (state.status === "idle") {
    return (
      <EmptyState
        title={uiText.specTree.noWorkspaceTitle}
        description={uiText.specTree.noWorkspaceDescription}
        variant="inline"
      />
    );
  }

  if (state.status === "loading") {
    return (
      <section className="spec-tree__status" aria-live="polite">
        <h2>{uiText.specTree.specs}</h2>
        <LoadingSkeleton
          label={uiText.specTree.loading}
          rows={[
            { width: "long" },
            { width: "medium" },
            { width: "full" },
            { width: "short" },
            { width: "medium" },
          ]}
        />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <CommandErrorDisplay
        title={uiText.specTree.loadError}
        error={state.error}
        actionLabel={uiText.sidebar.retry}
        onAction={onReload}
      />
    );
  }

  if (state.status === "empty") {
    return (
      <EmptyState
        title={uiText.specTree.noSpecsTitle}
        description={uiText.specTree.noSpecsDescription}
        action={
          <button
            className="icon-button"
            type="button"
            aria-label={uiText.specTree.refresh}
            title={uiText.specTree.refresh}
            onClick={onReload}
          >
            <RefreshCcw aria-hidden="true" size={16} />
          </button>
        }
        variant="inline"
      />
    );
  }

  return (
    <nav className="spec-tree" aria-label={uiText.specTree.tree}>
      <div className="spec-tree__header">
        <h2>{uiText.specTree.specs}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.specTree.refresh}
          title={uiText.specTree.refresh}
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </div>
      <ul className="spec-tree__list" role="tree">
        {state.tree.specs.map((node) => (
          <SpecTreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedSpecId={selectedSpecId}
            onSelectSpec={onSelectSpec}
          />
        ))}
      </ul>
    </nav>
  );
}

type SpecTreeItemProps = Readonly<{
  node: SpecNode;
  depth: number;
  selectedSpecId: string | null;
  onSelectSpec: (specId: string) => void;
}>;

/** @returns One spec tree row plus any child rows. */
function SpecTreeItem({
  node,
  depth,
  selectedSpecId,
  onSelectSpec,
}: SpecTreeItemProps) {
  const isSelected = selectedSpecId === node.id;

  return (
    <li>
      <button
        className="spec-tree__item"
        type="button"
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isSelected}
        tabIndex={isSelected || selectedSpecId === null ? 0 : -1}
        style={{
          paddingInlineStart:
            BASE_TREE_ITEM_INDENT + depth * TREE_ITEM_INDENT_STEP,
        }}
        onClick={() => {
          onSelectSpec(node.id);
        }}
        onKeyDown={handleTreeItemKeyDown}
      >
        <span>{node.label}</span>
        <span className="spec-tree__file-count">{node.files.length}</span>
      </button>
      {node.children.length === 0 ? null : (
        <ul className="spec-tree__list" role="group">
          {node.children.map((child) => (
            <SpecTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedSpecId={selectedSpecId}
              onSelectSpec={onSelectSpec}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Moves focus between visible tree items for arrow-key navigation. */
function handleTreeItemKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
  const nextIndex = getNextTreeItemIndex(event);

  if (nextIndex === null) {
    return;
  }

  const tree = event.currentTarget.closest('[role="tree"]');
  const items = Array.from(
    tree?.querySelectorAll<HTMLButtonElement>(".spec-tree__item") ?? [],
  );
  const nextItem = items[nextIndex];

  if (nextItem === undefined) {
    return;
  }

  event.preventDefault();
  nextItem.focus();
}

/** @returns The next tree item index for supported navigation keys. */
function getNextTreeItemIndex(
  event: KeyboardEvent<HTMLButtonElement>,
): number | null {
  const tree = event.currentTarget.closest('[role="tree"]');
  const items = Array.from(
    tree?.querySelectorAll<HTMLButtonElement>(".spec-tree__item") ?? [],
  );
  const currentIndex = items.indexOf(event.currentTarget);

  if (currentIndex < 0) {
    return null;
  }

  if (event.key === "ArrowDown") {
    return Math.min(currentIndex + 1, items.length - 1);
  }

  if (event.key === "ArrowUp") {
    return Math.max(currentIndex - 1, 0);
  }

  if (event.key === "Home") {
    return 0;
  }

  if (event.key === "End") {
    return items.length - 1;
  }

  if (event.key === "ArrowRight") {
    return findFirstChildTreeItemIndex(items, currentIndex);
  }

  if (event.key === "ArrowLeft") {
    return findParentTreeItemIndex(items, currentIndex);
  }

  return null;
}

/** @returns The first visible child item index, or null when the item is a leaf. */
function findFirstChildTreeItemIndex(
  items: readonly HTMLButtonElement[],
  currentIndex: number,
): number | null {
  const nextIndex = currentIndex + 1;
  const nextItem = items[nextIndex];

  if (nextItem === undefined) {
    return null;
  }

  const currentLevel = readTreeItemLevel(items[currentIndex]);
  const nextLevel = readTreeItemLevel(nextItem);

  return nextLevel > currentLevel ? nextIndex : null;
}

/** @returns The closest visible parent item index, or null for root items. */
function findParentTreeItemIndex(
  items: readonly HTMLButtonElement[],
  currentIndex: number,
): number | null {
  const currentLevel = readTreeItemLevel(items[currentIndex]);

  if (currentLevel <= 1) {
    return null;
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (readTreeItemLevel(items[index]) < currentLevel) {
      return index;
    }
  }

  return null;
}

/** @returns The aria tree level for a rendered tree item. */
function readTreeItemLevel(item: HTMLButtonElement | undefined): number {
  if (item === undefined) {
    return 1;
  }

  const level = Number(item.getAttribute("aria-level"));

  return Number.isFinite(level) ? level : 1;
}
