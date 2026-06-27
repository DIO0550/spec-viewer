import {
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";

import type { SpecTreeState } from "@/features/specs/hooks/useSpecs";
import { uiText } from "@/shared/lib/uiText";
import type { SpecNode } from "@/features/specs/types/spec";
import { CommandErrorDisplay } from "@/shared/ui/CommandErrorDisplay";
import { EmptyState } from "@/shared/ui/EmptyState";
import { LoadingSkeleton } from "@/shared/ui/LoadingSkeleton";

const BASE_TREE_ITEM_INDENT = 10;
const TREE_ITEM_INDENT_STEP = 16;

type Props = Readonly<{
  state: SpecTreeState;
  selectedSpecId: string | null;
  archivingSpecId?: string | null;
  isDocumentLoading?: boolean;
  isRefreshLoading?: boolean;
  onSelectSpec: (specId: string) => void;
  onArchiveSpec?: (specId: string) => void;
  onReload: () => void;
}>;

/** @returns A navigable spec tree sidebar with loading, error, and empty states. */
export function SpecTree({
  state,
  selectedSpecId,
  archivingSpecId = null,
  isDocumentLoading = false,
  isRefreshLoading = false,
  onSelectSpec,
  onArchiveSpec,
  onReload,
}: Props) {
  const [expandedSpecIds, setExpandedSpecIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (state.status !== "ready" || selectedSpecId === null) {
      return;
    }

    const ancestorIds = findAncestorSpecIds(state.tree.specs, selectedSpecId);

    if (ancestorIds.length === 0) {
      return;
    }

    setExpandedSpecIds((currentIds) => {
      const nextIds = new Set(currentIds);

      ancestorIds.forEach((id) => {
        nextIds.add(id);
      });

      return nextIds;
    });
  }, [selectedSpecId, state]);

  const isArchivingSpec = archivingSpecId !== null;
  const isReloadDisabled =
    state.status === "loading" ||
    isDocumentLoading ||
    isRefreshLoading ||
    isArchivingSpec;
  const isSelectionDisabled = state.status === "loading" || isDocumentLoading;
  const isArchiveDisabled =
    state.status === "loading" ||
    isDocumentLoading ||
    isRefreshLoading ||
    isArchivingSpec;

  const toggleSpecExpanded = (specId: string): void => {
    setExpandedSpecIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(specId)) {
        nextIds.delete(specId);
        return nextIds;
      }

      nextIds.add(specId);
      return nextIds;
    });
  };

  const reloadWhenEnabled = (): void => {
    if (isReloadDisabled) {
      return;
    }

    onReload();
  };

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
        isActionDisabled={isReloadDisabled}
        onAction={reloadWhenEnabled}
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
            disabled={isReloadDisabled}
            onClick={reloadWhenEnabled}
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
          disabled={isReloadDisabled}
          onClick={reloadWhenEnabled}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="spec-tree__list" role="tree">
        {state.tree.specs.map((node) => (
          <SpecTreeItem
            key={node.id}
            node={node}
            depth={0}
            expandedSpecIds={expandedSpecIds}
            selectedSpecId={selectedSpecId}
            archivingSpecId={archivingSpecId}
            isSelectionDisabled={isSelectionDisabled}
            isArchiveDisabled={isArchiveDisabled}
            onSelectSpec={onSelectSpec}
            onArchiveSpec={onArchiveSpec}
            onToggleExpanded={toggleSpecExpanded}
          />
        ))}
      </div>
    </nav>
  );
}

type SpecTreeItemProps = Readonly<{
  node: SpecNode;
  depth: number;
  expandedSpecIds: ReadonlySet<string>;
  selectedSpecId: string | null;
  archivingSpecId: string | null;
  isSelectionDisabled: boolean;
  isArchiveDisabled: boolean;
  onSelectSpec: (specId: string) => void;
  onArchiveSpec?: (specId: string) => void;
  onToggleExpanded: (specId: string) => void;
}>;

/** @returns One spec tree row plus any child rows. */
function SpecTreeItem({
  node,
  depth,
  expandedSpecIds,
  selectedSpecId,
  archivingSpecId,
  isSelectionDisabled,
  isArchiveDisabled,
  onSelectSpec,
  onArchiveSpec,
  onToggleExpanded,
}: SpecTreeItemProps) {
  const isSelected = selectedSpecId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedSpecIds.has(node.id);
  const canArchive = onArchiveSpec !== undefined && isArchivableSpecNode(node);
  const isArchiving = archivingSpecId === node.id;
  const indentation = BASE_TREE_ITEM_INDENT + depth * TREE_ITEM_INDENT_STEP;

  return (
    <div className="spec-tree__node" role="none">
      <div
        className="spec-tree__row"
        style={{
          paddingInlineStart: indentation,
        }}
      >
        {hasChildren ? (
          <button
            className="icon-button spec-tree__expand"
            type="button"
            aria-label={
              isExpanded ? `${node.label}を折りたたむ` : `${node.label}を展開`
            }
            aria-expanded={isExpanded}
            title={
              isExpanded ? `${node.label}を折りたたむ` : `${node.label}を展開`
            }
            onClick={() => {
              onToggleExpanded(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" size={14} />
            ) : (
              <ChevronRight aria-hidden="true" size={14} />
            )}
          </button>
        ) : (
          <span className="spec-tree__expand-spacer" aria-hidden="true" />
        )}
        <button
          className="spec-tree__item"
          type="button"
          role="treeitem"
          aria-level={depth + 1}
          aria-selected={isSelected}
          tabIndex={isSelected || selectedSpecId === null ? 0 : -1}
          disabled={isSelectionDisabled}
          onClick={() => {
            if (isSelectionDisabled) {
              return;
            }

            onSelectSpec(node.id);
          }}
          onKeyDown={(event) => {
            handleTreeItemKeyDown(event, {
              hasChildren,
              isExpanded,
              onToggleExpanded: () => {
                onToggleExpanded(node.id);
              },
            });
          }}
        >
          <FileText
            className="spec-tree__item-icon"
            aria-hidden="true"
            size={14}
          />
          <span className="spec-tree__item-label">{node.label}</span>
          <span className="spec-tree__file-count">{node.files.length}</span>
        </button>
        {canArchive ? (
          <button
            className="icon-button spec-tree__archive"
            type="button"
            aria-label={`${node.label}をアーカイブへ移動`}
            title={uiText.specTree.archive}
            disabled={isArchiveDisabled}
            data-archiving={isArchiving ? "true" : "false"}
            onClick={() => {
              if (isArchiveDisabled) {
                return;
              }

              onArchiveSpec?.(node.id);
            }}
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        ) : (
          <span className="spec-tree__archive-spacer" aria-hidden="true" />
        )}
      </div>
      {hasChildren && isExpanded ? (
        <div className="spec-tree__list">
          {node.children.map((child) => (
            <SpecTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedSpecIds={expandedSpecIds}
              selectedSpecId={selectedSpecId}
              archivingSpecId={archivingSpecId}
              isSelectionDisabled={isSelectionDisabled}
              isArchiveDisabled={isArchiveDisabled}
              onSelectSpec={onSelectSpec}
              onArchiveSpec={onArchiveSpec}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** @returns Whether this tree node represents an archiveable spec directory. */
function isArchivableSpecNode(node: SpecNode): boolean {
  return !node.id.endsWith("/.specs");
}

type TreeItemKeyDownOptions = Readonly<{
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}>;

/** Moves focus between visible tree items for arrow-key navigation. */
function handleTreeItemKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  options: TreeItemKeyDownOptions,
): void {
  if (
    event.key === "ArrowRight" &&
    options.hasChildren &&
    !options.isExpanded
  ) {
    event.preventDefault();
    options.onToggleExpanded();
    return;
  }

  if (event.key === "ArrowLeft" && options.hasChildren && options.isExpanded) {
    event.preventDefault();
    options.onToggleExpanded();
    return;
  }

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

/** @returns Ancestor spec IDs for the selected node, excluding the selected ID. */
function findAncestorSpecIds(
  nodes: readonly SpecNode[],
  selectedSpecId: string,
  ancestors: readonly string[] = [],
): readonly string[] {
  for (const node of nodes) {
    if (node.id === selectedSpecId) {
      return ancestors;
    }

    const childAncestors = findAncestorSpecIds(node.children, selectedSpecId, [
      ...ancestors,
      node.id,
    ]);

    if (childAncestors.length > 0) {
      return childAncestors;
    }
  }

  return [];
}
