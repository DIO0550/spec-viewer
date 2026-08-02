import {
  Archive as ArchiveIcon,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Layers3,
  RefreshCcw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { CommandErrorDisplay } from "@/components/CommandErrorDisplay";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { SpecNode as SpecNodeDomain } from "@/features/specs/domain/specNode";
import {
  pruneSpecTreeExpansion,
  revealSpecTreeDestination,
  specNodeIdentityKey,
  toggleSpecTreeNode,
  createSpecTreePresentationState,
  type SpecTreePresentationState,
} from "@/features/specs/domain/specTreePresentation";
import type {
  ArchiveFailure,
  ArchiveRevealState,
} from "@/features/specs/hooks/useSpecs/types";
import type { SpecTreeState } from "@/features/specs/hooks/useSpecs";
import type { SpecNode, SpecNodeKind } from "@/features/specs/types/spec";
import { uiText } from "@/utils/uiText";

const BASE_TREE_ITEM_INDENT = 10;
const TREE_ITEM_INDENT_STEP = 16;
const EMPTY_CHANGE_BADGES: ReadonlyMap<string, "M" | "U"> = new Map();

type Props = Readonly<{
  state: SpecTreeState;
  selectedSpecId: string | null;
  changeBadgesBySpecId?: ReadonlyMap<string, "M" | "U">;
  archivingSpecId?: string | null;
  archiveFailure?: ArchiveFailure | null;
  archiveReveal?: ArchiveRevealState | null;
  isLoading?: boolean;
  onSelectSpec: (specId: string) => void;
  onArchiveSpec?: (specId: string) => void;
  onRetryArchive?: () => void;
  onRefreshArchiveReveal?: () => void;
  onReload: () => void;
}>;

/** Renders a semantic, keyboard-navigable Specs tree. */
export function SpecTree({
  state,
  selectedSpecId,
  changeBadgesBySpecId = EMPTY_CHANGE_BADGES,
  archivingSpecId = null,
  archiveFailure = null,
  archiveReveal = null,
  isLoading = false,
  onSelectSpec,
  onArchiveSpec,
  onRetryArchive,
  onRefreshArchiveReveal,
  onReload,
}: Props) {
  const [presentation, setPresentation] = useState<SpecTreePresentationState>(
    () => createSpecTreePresentationState(state.workspacePath, 0),
  );
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (state.status === "loading" || state.status === "idle") {
      setPresentation((current) =>
        createSpecTreePresentationState(
          state.workspacePath,
          current.loadGeneration + 1,
        ),
      );
      return;
    }

    if (state.tree !== null) {
      setPresentation((current) => pruneSpecTreeExpansion(current, state.tree));
    }
  }, [state]);

  useEffect(() => {
    if (state.status !== "ready" || selectedSpecId === null) {
      return;
    }

    const path = findPathById(state.tree.specs, selectedSpecId);
    setPresentation((current) => {
      const expandedNodeKeys = new Set(current.expandedNodeKeys);
      path.slice(0, -1).forEach((node) => {
        if (node.kind !== "archive" && node.children.length > 0) {
          expandedNodeKeys.add(specNodeIdentityKey(node));
        }
      });
      return { ...current, expandedNodeKeys };
    });
  }, [selectedSpecId, state]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      archiveReveal?.status !== "success" ||
      archiveReveal.workspacePath !== state.workspacePath
    ) {
      return;
    }

    const target = {
      sourceGroupId: archiveReveal.response.sourceGroupId,
      relativeId: archiveReveal.response.destinationNodeId,
    };
    setPresentation((current) =>
      revealSpecTreeDestination(current, state.tree, {
        workspacePath: archiveReveal.workspacePath,
        loadGeneration: current.loadGeneration,
        target,
      }),
    );
    requestAnimationFrame(() => {
      const row = rowRefs.current.get(specNodeIdentityKey(target));
      row?.focus();
      row?.scrollIntoView?.({ block: "nearest" });
    });
  }, [archiveReveal, state]);

  const isActionDisabled =
    state.status === "loading" || isLoading || archivingSpecId !== null;

  const reloadWhenEnabled = (): void => {
    if (!isActionDisabled) {
      onReload();
    }
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
        isActionDisabled={isActionDisabled}
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
            disabled={isActionDisabled}
            onClick={reloadWhenEnabled}
          >
            <RefreshCcw aria-hidden="true" size={16} />
          </button>
        }
        variant="inline"
      />
    );
  }

  const firstNodeId = state.tree.specs[0]?.id ?? null;

  return (
    <nav
      className="spec-tree"
      aria-label={uiText.specTree.tree}
      aria-busy={isActionDisabled}
    >
      <div className="spec-tree__header">
        <h2>{uiText.specTree.specs}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={uiText.specTree.refresh}
          title={uiText.specTree.refresh}
          disabled={isActionDisabled}
          onClick={reloadWhenEnabled}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </div>
      {archiveReveal?.status === "missing" ? (
        <div className="spec-tree__notice" role="alert">
          <span>{uiText.specTree.revealMissing}</span>
          <button
            type="button"
            disabled={isActionDisabled}
            onClick={onRefreshArchiveReveal}
          >
            <RefreshCcw aria-hidden="true" size={13} />
            {uiText.specTree.refresh}
          </button>
        </div>
      ) : null}
      <div className="spec-tree__list" role="tree">
        {state.tree.specs.map((node) => (
          <SpecTreeItem
            key={specNodeIdentityKey(node)}
            node={node}
            depth={0}
            insideArchive={false}
            presentation={presentation}
            selectedSpecId={selectedSpecId}
            changeBadgesBySpecId={changeBadgesBySpecId}
            initialFocusNodeId={firstNodeId}
            archivingSpecId={archivingSpecId}
            archiveFailure={archiveFailure}
            isActionDisabled={isActionDisabled}
            onSelectSpec={onSelectSpec}
            onArchiveSpec={onArchiveSpec}
            onRetryArchive={onRetryArchive}
            onToggle={(target) => {
              setPresentation((current) => toggleSpecTreeNode(current, target));
            }}
            registerRow={(key, row) => {
              if (row === null) {
                rowRefs.current.delete(key);
              } else {
                rowRefs.current.set(key, row);
              }
            }}
          />
        ))}
      </div>
    </nav>
  );
}

type SpecTreeItemProps = Readonly<{
  node: SpecNode;
  depth: number;
  insideArchive: boolean;
  presentation: SpecTreePresentationState;
  selectedSpecId: string | null;
  changeBadgesBySpecId: ReadonlyMap<string, "M" | "U">;
  initialFocusNodeId: string | null;
  archivingSpecId: string | null;
  archiveFailure: ArchiveFailure | null;
  isActionDisabled: boolean;
  onSelectSpec: (specId: string) => void;
  onArchiveSpec?: (specId: string) => void;
  onRetryArchive?: () => void;
  onToggle: (node: SpecNode) => void;
  registerRow: (key: string, row: HTMLButtonElement | null) => void;
}>;

/** Renders one semantic node and its visible descendants. */
function SpecTreeItem(props: SpecTreeItemProps) {
  const {
    node,
    depth,
    insideArchive,
    presentation,
    selectedSpecId,
    changeBadgesBySpecId,
    initialFocusNodeId,
    archivingSpecId,
    archiveFailure,
    isActionDisabled,
    onSelectSpec,
    onArchiveSpec,
    onRetryArchive,
    onToggle,
    registerRow,
  } = props;
  const key = specNodeIdentityKey(node);
  const isSpec = SpecNodeDomain.isOpenable(node);
  const isSelected = isSpec && selectedSpecId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = presentation.expandedNodeKeys.has(key);
  const descendantsAreArchived = insideArchive || node.kind === "archive";
  const canArchive =
    onArchiveSpec !== undefined &&
    SpecNodeDomain.isArchivable(node) &&
    !insideArchive;
  const isArchiving = archivingSpecId === node.id;
  const hasFailure = archiveFailure?.specId === node.id;
  const indentation = BASE_TREE_ITEM_INDENT + depth * TREE_ITEM_INDENT_STEP;

  const activateNode = (): void => {
    if (isActionDisabled) {
      return;
    }

    if (isSpec) {
      onSelectSpec(node.id);
      return;
    }

    if (hasChildren) {
      onToggle(node);
    }
  };

  return (
    <div className="spec-tree__node" role="none">
      <div
        className="spec-tree__row"
        style={{ paddingInlineStart: indentation }}
      >
        <button
          ref={(row) => {
            registerRow(key, row);
          }}
          className="spec-tree__item"
          type="button"
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={
            isSelected ||
            (selectedSpecId === null && node.id === initialFocusNodeId)
              ? 0
              : -1
          }
          disabled={isActionDisabled}
          data-node-key={key}
          data-node-kind={node.kind}
          onClick={activateNode}
          onKeyDown={(event) => {
            handleTreeItemKeyDown(event, {
              hasChildren,
              isExpanded,
              isSpec,
              onActivate: activateNode,
              onToggleExpanded: () => {
                onToggle(node);
              },
            });
          }}
        >
          <span
            className="spec-tree__chevron"
            role={hasChildren ? "button" : undefined}
            aria-label={
              hasChildren
                ? node.label + (isExpanded ? "を折りたたむ" : "を展開")
                : undefined
            }
            aria-expanded={hasChildren ? isExpanded : undefined}
            onClick={
              hasChildren
                ? (event) => {
                    event.stopPropagation();
                    onToggle(node);
                  }
                : undefined
            }
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown aria-hidden="true" size={14} />
              ) : (
                <ChevronRight aria-hidden="true" size={14} />
              )
            ) : null}
          </span>
          <NodeKindIcon kind={node.kind} />
          <span className="spec-tree__item-label">{node.label}</span>
          {isSpec && !insideArchive && changeBadgesBySpecId.has(node.id) ? (
            <span
              className="spec-tree__change-badge"
              aria-label={
                changeBadgesBySpecId.get(node.id) === "U"
                  ? "未追跡の変更あり"
                  : "変更あり"
              }
            >
              {changeBadgesBySpecId.get(node.id)}
            </span>
          ) : null}
          <span className="spec-tree__file-count">
            {SpecNodeDomain.count(node)}
          </span>
        </button>
        {canArchive ? (
          <button
            className="icon-button spec-tree__archive"
            type="button"
            aria-label={node.label + uiText.specTree.archiveSuffix}
            title={uiText.specTree.archive}
            disabled={isActionDisabled}
            data-archiving={isArchiving ? "true" : "false"}
            onClick={() => {
              if (!isActionDisabled) {
                onArchiveSpec?.(node.id);
              }
            }}
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        ) : (
          <span className="spec-tree__archive-spacer" aria-hidden="true" />
        )}
      </div>
      {hasFailure ? (
        <div className="spec-tree__inline-error" role="alert">
          <span>{archiveFailure.error.message}</span>
          <button
            type="button"
            disabled={isActionDisabled}
            onClick={onRetryArchive}
          >
            <RotateCcw aria-hidden="true" size={13} />
            {uiText.specTree.retryArchive}
          </button>
        </div>
      ) : null}
      {hasChildren && isExpanded ? (
        <div className="spec-tree__list" role="group">
          {node.children.map((child) => (
            <SpecTreeItem
              {...props}
              key={specNodeIdentityKey(child)}
              node={child}
              depth={depth + 1}
              insideArchive={descendantsAreArchived}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Renders the icon assigned to a semantic node kind. */
function NodeKindIcon({ kind }: Readonly<{ kind: SpecNodeKind }>): ReactNode {
  const iconProps = {
    className: "spec-tree__item-icon",
    "aria-hidden": true,
    size: 14,
  } as const;

  if (kind === "category") {
    return <Folder {...iconProps} />;
  }
  if (kind === "archive") {
    return <ArchiveIcon {...iconProps} />;
  }
  if (kind === "sourceGroup") {
    return <Layers3 {...iconProps} />;
  }

  return <FileText {...iconProps} />;
}

type TreeItemKeyDownOptions = Readonly<{
  hasChildren: boolean;
  isExpanded: boolean;
  isSpec: boolean;
  onActivate: () => void;
  onToggleExpanded: () => void;
}>;

/** Handles activation, expansion, and roving focus keyboard commands. */
function handleTreeItemKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  options: TreeItemKeyDownOptions,
): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    options.onActivate();
    return;
  }

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

  if (nextItem !== undefined) {
    event.preventDefault();
    nextItem.focus();
  }
}

/** Returns the next visible tree item index for navigation keys. */
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

/** Returns the first visible child index, or null for a leaf. */
function findFirstChildTreeItemIndex(
  items: readonly HTMLButtonElement[],
  currentIndex: number,
): number | null {
  const nextIndex = currentIndex + 1;
  const nextItem = items[nextIndex];
  if (nextItem === undefined) {
    return null;
  }

  return readTreeItemLevel(nextItem) > readTreeItemLevel(items[currentIndex])
    ? nextIndex
    : null;
}

/** Returns the closest visible parent index, or null at level one. */
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

/** Returns the node path for a legacy global id. */
function findPathById(
  nodes: readonly SpecNode[],
  id: string,
  ancestors: readonly SpecNode[] = [],
): readonly SpecNode[] {
  for (const node of nodes) {
    const path = [...ancestors, node];
    if (node.id === id) {
      return path;
    }

    const childPath = findPathById(node.children, id, path);
    if (childPath.length > 0) {
      return childPath;
    }
  }

  return [];
}

/** Reads the ARIA tree level with a safe root fallback. */
function readTreeItemLevel(item: HTMLButtonElement | undefined): number {
  if (item === undefined) {
    return 1;
  }

  const level = Number(item.getAttribute("aria-level"));
  return Number.isFinite(level) ? level : 1;
}
