import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";

import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type {
  WorktreeRowCount,
  WorktreeTreeNode,
} from "@/features/workspace/types/worktreeTreeNode";

export type WorktreeTreeProps = Readonly<{
  nodes: readonly WorktreeTreeNode[];
  selectedWorktreeId: WorktreeId | null;
  emptyLabel: string;
  onSelectWorktree: (worktreeId: WorktreeId) => void;
}>;

type VisibleNode = Readonly<{
  node: WorktreeTreeNode;
  parentId: string | null;
  depth: number;
}>;

/**
 * Displays hierarchical Specs worktrees and flat Diff worktrees with one tree.
 *
 * @param props - Projected nodes and controlled worktree selection.
 * @returns An accessible worktree tree or its empty state.
 */
export function WorktreeTree(props: WorktreeTreeProps): ReactElement {
  const { nodes, selectedWorktreeId, emptyLabel, onSelectWorktree } = props;
  const [expandedIds, setExpandedIds] = useState(
    () => new Set(listCategoryIds(nodes)),
  );
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const availableIds = new Set(listCategoryIds(nodes));
    setExpandedIds(
      (current) =>
        new Set([
          ...[...current].filter((id) => availableIds.has(id)),
          ...[...availableIds].filter((id) => !current.has(id)),
        ]),
    );
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <p className="worktree-tree__empty" role="status" aria-live="polite">
        {emptyLabel}
      </p>
    );
  }

  const visibleNodes = flattenVisibleNodes(nodes, expandedIds);
  const selectedIsVisible = visibleNodes.some(
    ({ node }) => node.kind === "worktree" && node.id === selectedWorktreeId,
  );
  const tabbableId = selectedIsVisible
    ? selectedWorktreeId
    : visibleNodes[0]?.node.id;

  const focusAt = (index: number): void => {
    const target = visibleNodes[index];
    if (target !== undefined) {
      itemRefs.current.get(target.node.id)?.focus();
    }
  };

  const toggleCategory = (id: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    visibleNode: VisibleNode,
  ): void => {
    const { node, parentId } = visibleNode;
    const index = visibleNodes.findIndex(
      ({ node: candidate }) => candidate.id === node.id,
    );

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(Math.min(index + 1, visibleNodes.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusAt(event.key === "Home" ? 0 : visibleNodes.length - 1);
      return;
    }
    if (node.kind === "category" && event.key === "ArrowRight") {
      event.preventDefault();
      if (expandedIds.has(node.id)) {
        focusAt(index + 1);
      } else {
        toggleCategory(node.id);
      }
      return;
    }
    if (node.kind === "category" && event.key === "ArrowLeft") {
      event.preventDefault();
      if (expandedIds.has(node.id)) {
        toggleCategory(node.id);
      } else if (parentId !== null) {
        itemRefs.current.get(parentId)?.focus();
      }
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (node.kind === "category") {
      toggleCategory(node.id);
    } else {
      onSelectWorktree(node.id);
    }
  };

  return (
    <div className="worktree-tree" role="tree" aria-label="Worktrees">
      <TreeLevel
        nodes={nodes}
        depth={0}
        parentId={null}
        expandedIds={expandedIds}
        selectedWorktreeId={selectedWorktreeId}
        tabbableId={tabbableId}
        itemRefs={itemRefs.current}
        onToggleCategory={toggleCategory}
        onSelectWorktree={onSelectWorktree}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

type TreeLevelProps = Readonly<{
  nodes: readonly WorktreeTreeNode[];
  depth: number;
  parentId: string | null;
  expandedIds: ReadonlySet<string>;
  selectedWorktreeId: WorktreeId | null;
  tabbableId: string | null | undefined;
  itemRefs: Map<string, HTMLButtonElement>;
  onToggleCategory: (id: string) => void;
  onSelectWorktree: (id: WorktreeId) => void;
  onKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    visibleNode: VisibleNode,
  ) => void;
}>;

/**
 * Recursively renders one ARIA tree level.
 *
 *  props - Nodes and shared tree interaction controls.
 *  Tree items with nested groups for expanded categories.
 */
function TreeLevel(props: TreeLevelProps): ReactElement {
  const {
    nodes,
    depth,
    parentId,
    expandedIds,
    selectedWorktreeId,
    tabbableId,
    itemRefs,
    onToggleCategory,
    onSelectWorktree,
    onKeyDown,
  } = props;

  return (
    <>
      {nodes.map((node) => {
        const isCategory = node.kind === "category";
        const isExpanded = isCategory && expandedIds.has(node.id);
        const isSelected =
          node.kind === "worktree" && node.id === selectedWorktreeId;

        return (
          <div className="worktree-tree__node" key={node.id}>
            <button
              ref={(element) => {
                if (element === null) {
                  itemRefs.delete(node.id);
                } else {
                  itemRefs.set(node.id, element);
                }
              }}
              className="worktree-tree__item"
              style={{ paddingInlineStart: `px` }}
              type="button"
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={isCategory ? isExpanded : undefined}
              aria-current={isSelected ? "page" : undefined}
              tabIndex={node.id === tabbableId ? 0 : -1}
              onClick={() => {
                if (node.kind === "category") {
                  onToggleCategory(node.id);
                } else {
                  onSelectWorktree(node.id);
                }
              }}
              onKeyDown={(event) => {
                onKeyDown(event, { node, parentId, depth });
              }}
            >
              {isCategory ? (
                isExpanded ? (
                  <ChevronDown aria-hidden="true" size={14} />
                ) : (
                  <ChevronRight aria-hidden="true" size={14} />
                )
              ) : (
                <GitBranch aria-hidden="true" size={14} />
              )}
              <span className="worktree-tree__label">{node.label}</span>
              {node.kind === "worktree" ? (
                <span
                  className="worktree-tree__count"
                  aria-label={formatWorktreeCountLabel(node.count)}
                >
                  {formatWorktreeCount(node.count)}
                </span>
              ) : null}
            </button>
            {node.kind === "category" && isExpanded ? (
              <div className="worktree-tree__group" role="group">
                <TreeLevel
                  {...props}
                  nodes={node.children}
                  depth={depth + 1}
                  parentId={node.id}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function flattenVisibleNodes(
  nodes: readonly WorktreeTreeNode[],
  expandedIds: ReadonlySet<string>,
  parentId: string | null = null,
  depth = 0,
): readonly VisibleNode[] {
  return nodes.flatMap((node) => [
    { node, parentId, depth },
    ...(node.kind === "category" && expandedIds.has(node.id)
      ? flattenVisibleNodes(node.children, expandedIds, node.id, depth + 1)
      : []),
  ]);
}

function listCategoryIds(
  nodes: readonly WorktreeTreeNode[],
): readonly string[] {
  return nodes.flatMap((node) =>
    node.kind === "category"
      ? [node.id, ...listCategoryIds(node.children)]
      : [],
  );
}

function formatWorktreeCountLabel(count: WorktreeRowCount): string {
  return count.kind === "spec-count"
    ? `仕様 ${count.value}件`
    : `変更ファイル ${count.value}件`;
}

function formatWorktreeCount(count: WorktreeRowCount): string {
  return String(count.value);
}
