import {
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";
import type {
  RepositoryDiffFilter,
  RepositoryDiffTreeProjectionNode,
} from "@/features/repositoryDiff/domain/repositoryDiff";

export type RepositoryDiffTreeAvailability =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "error"; message: string }>
  | Readonly<{ status: "stale"; message: string }>;

export type RepositoryDiffTreeProps = Readonly<{
  filter: RepositoryDiffFilter;
  nodes: readonly RepositoryDiffTreeProjectionNode[];
  selectedPath: string | null;
  expandedPaths: readonly string[];
  availability: RepositoryDiffTreeAvailability;
  onSelectFile: (path: string) => void;
  onToggleDirectory: (path: string) => void;
  onLoadChildren?: (nodeId: string, cursor?: string | null) => void;
  onRetry?: () => void;
}>;

type VisibleNode = Readonly<{
  node: RepositoryDiffTreeProjectionNode;
  parentId: string | null;
  depth: number;
}>;

const TREE_ITEM_INDENT = 10;
const TREE_ITEM_INDENT_STEP = 16;

/** Displays the controlled repository tree and its safe async states. */
export function RepositoryDiffTree(
  props: RepositoryDiffTreeProps,
): ReactElement {
  const {
    filter,
    nodes,
    selectedPath,
    expandedPaths,
    availability,
    onSelectFile,
    onToggleDirectory,
    onLoadChildren,
    onRetry,
  } = props;
  const [focusedId, setFocusedId] = useState<string | null>(
    nodes[0]?.id ?? null,
  );
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const expandedSet = useMemo(() => new Set(expandedPaths), [expandedPaths]);
  const visibleNodes = useMemo(
    () => flattenVisibleNodes(nodes, expandedSet),
    [expandedSet, nodes],
  );

  useEffect(() => {
    const selected = visibleNodes.find(
      ({ node }) => node.path === selectedPath,
    );
    const focusedIsVisible = visibleNodes.some(
      ({ node }) => node.id === focusedId,
    );
    if (selected !== undefined && selected.node.id !== focusedId) {
      setFocusedId(selected.node.id);
      return;
    }
    if (!focusedIsVisible) {
      setFocusedId(visibleNodes[0]?.node.id ?? null);
    }
  }, [focusedId, selectedPath, visibleNodes]);

  const focusAt = useCallback(
    (index: number): void => {
      const target = visibleNodes[index];
      if (target === undefined) {
        return;
      }
      setFocusedId(target.node.id);
      itemRefs.current.get(target.node.id)?.focus();
    },
    [visibleNodes],
  );

  const toggleNode = useCallback(
    (node: RepositoryDiffTreeProjectionNode): void => {
      const isExpanded = expandedSet.has(node.path);
      onToggleDirectory(node.path);
      if (
        !isExpanded &&
        node.children.state === "deferred" &&
        node.deferredNodeId !== null
      ) {
        onLoadChildren?.(node.deferredNodeId, null);
      }
    },
    [expandedSet, onLoadChildren, onToggleDirectory],
  );

  const handleKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLButtonElement>,
      visibleNode: VisibleNode,
    ): void => {
      const index = visibleNodes.findIndex(
        ({ node }) => node.id === visibleNode.node.id,
      );
      const { node } = visibleNode;
      const expandable = isExpandable(node);
      const isExpanded = expandedSet.has(node.path);

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
      if (event.key === "ArrowRight" && expandable) {
        event.preventDefault();
        if (isExpanded) {
          focusAt(index + 1);
        } else {
          toggleNode(node);
        }
        return;
      }
      if (event.key === "ArrowLeft" && expandable) {
        event.preventDefault();
        if (isExpanded) {
          onToggleDirectory(node.path);
        } else if (visibleNode.parentId !== null) {
          setFocusedId(visibleNode.parentId);
          itemRefs.current.get(visibleNode.parentId)?.focus();
        }
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      if (expandable) {
        toggleNode(node);
      } else {
        onSelectFile(node.path);
      }
    },
    [
      expandedSet,
      focusAt,
      onSelectFile,
      onToggleDirectory,
      toggleNode,
      visibleNodes,
    ],
  );

  if (availability.status === "loading") {
    return (
      <p
        className="repository-diff-tree__status"
        role="status"
        aria-live="polite"
      >
        Repository diffを読み込んでいます。
      </p>
    );
  }

  if (availability.status === "error") {
    return (
      <div className="repository-diff-tree__error" role="alert">
        <p>{availability.message}</p>
        {onRetry === undefined ? null : (
          <button type="button" onClick={onRetry}>
            再試行
          </button>
        )}
      </div>
    );
  }

  if (availability.status === "stale") {
    return (
      <div
        className="repository-diff-tree__stale"
        role="status"
        aria-live="polite"
      >
        <p>{availability.message}</p>
        {onRetry === undefined ? null : (
          <button type="button" onClick={onRetry}>
            最新状態を再取得
          </button>
        )}
      </div>
    );
  }

  if (availability.status === "empty" || nodes.length === 0) {
    return (
      <p
        className="repository-diff-tree__status"
        role="status"
        aria-live="polite"
      >
        {filter === "changed"
          ? "変更ファイルはありません。"
          : "ファイルはありません。"}
      </p>
    );
  }

  const tabbableId = visibleNodes.some(({ node }) => node.id === focusedId)
    ? focusedId
    : (visibleNodes[0]?.node.id ?? null);

  return (
    <div
      className="repository-diff-tree"
      role="tree"
      aria-label={
        filter === "changed" ? "変更ファイルツリー" : "全ファイルツリー"
      }
      aria-busy={false}
    >
      <TreeLevel
        nodes={nodes}
        depth={0}
        parentId={null}
        expandedSet={expandedSet}
        selectedPath={selectedPath}
        tabbableId={tabbableId}
        itemRefs={itemRefs.current}
        onToggleNode={toggleNode}
        onSelectFile={onSelectFile}
        onLoadChildren={onLoadChildren}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

type TreeLevelProps = Readonly<{
  nodes: readonly RepositoryDiffTreeProjectionNode[];
  depth: number;
  parentId: string | null;
  expandedSet: ReadonlySet<string>;
  selectedPath: string | null;
  tabbableId: string | null;
  itemRefs: Map<string, HTMLButtonElement>;
  onToggleNode: (node: RepositoryDiffTreeProjectionNode) => void;
  onSelectFile: (path: string) => void;
  onLoadChildren?: (nodeId: string, cursor?: string | null) => void;
  onKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    visibleNode: VisibleNode,
  ) => void;
}>;

function TreeLevel(props: TreeLevelProps): ReactElement {
  const {
    nodes,
    depth,
    parentId,
    expandedSet,
    selectedPath,
    tabbableId,
    itemRefs,
    onToggleNode,
    onSelectFile,
    onLoadChildren,
    onKeyDown,
  } = props;

  return (
    <>
      {nodes.map((node) => {
        const expandable = isExpandable(node);
        const isExpanded = expandable && expandedSet.has(node.path);
        const isSelected = node.path === selectedPath && node.kind === "file";
        const indentation = TREE_ITEM_INDENT + depth * TREE_ITEM_INDENT_STEP;
        const visibleNode = { node, parentId, depth };

        return (
          <div className="repository-diff-tree__node" key={node.id}>
            <button
              ref={(element) => {
                if (element === null) {
                  itemRefs.delete(node.id);
                  return;
                }
                itemRefs.set(node.id, element);
              }}
              className="repository-diff-tree__item"
              style={{ paddingInlineStart: indentation }}
              type="button"
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={expandable ? isExpanded : undefined}
              aria-selected={isSelected}
              tabIndex={node.id === tabbableId ? 0 : -1}
              onClick={() => {
                if (expandable) {
                  onToggleNode(node);
                  return;
                }
                onSelectFile(node.path);
              }}
              onKeyDown={(event) => onKeyDown(event, visibleNode)}
            >
              <span
                className="repository-diff-tree__chevron"
                aria-hidden="true"
              >
                {expandable ? (isExpanded ? "▾" : "▸") : ""}
              </span>
              <span className="repository-diff-tree__token" aria-hidden="true">
                {getNodeToken(node)}
              </span>
              <span className="repository-diff-tree__sr-label">
                {getNodeLabel(node)}
              </span>
              <span className="repository-diff-tree__name">{node.name}</span>
              {node.path === node.name ? null : (
                <span className="repository-diff-tree__path">{node.path}</span>
              )}
            </button>
            {isExpanded ? (
              // biome-ignore lint/a11y/useSemanticElements: ARIA tree groups require role=group.
              <div
                className="repository-diff-tree__group"
                role="group"
                aria-label={`${node.name} の子項目`}
              >
                <TreeLevel
                  nodes={node.children.items}
                  depth={depth + 1}
                  parentId={node.id}
                  expandedSet={expandedSet}
                  selectedPath={selectedPath}
                  tabbableId={tabbableId}
                  itemRefs={itemRefs}
                  onToggleNode={onToggleNode}
                  onSelectFile={onSelectFile}
                  onLoadChildren={onLoadChildren}
                  onKeyDown={onKeyDown}
                />
                <ChildState node={node} onLoadChildren={onLoadChildren} />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

type ChildStateProps = Readonly<{
  node: RepositoryDiffTreeProjectionNode;
  onLoadChildren?: (nodeId: string, cursor?: string | null) => void;
}>;

function ChildState({
  node,
  onLoadChildren,
}: ChildStateProps): ReactElement | null {
  const { children, deferredNodeId } = node;
  if (children.state === "loading") {
    return (
      <p className="repository-diff-tree__child-status" role="status">
        子項目を読み込んでいます。
      </p>
    );
  }
  if (children.state === "failed") {
    return (
      <div className="repository-diff-tree__child-error" role="alert">
        <span>{children.message ?? "子項目を読み込めませんでした。"}</span>
        {deferredNodeId === null || onLoadChildren === undefined ? null : (
          <button
            type="button"
            onClick={() => onLoadChildren(deferredNodeId, children.nextCursor)}
          >
            再試行
          </button>
        )}
      </div>
    );
  }
  if (
    children.nextCursor === null ||
    deferredNodeId === null ||
    onLoadChildren === undefined
  ) {
    return null;
  }
  return (
    <button
      className="repository-diff-tree__load-more"
      type="button"
      onClick={() => onLoadChildren(deferredNodeId, children.nextCursor)}
    >
      さらに読み込む
    </button>
  );
}

function flattenVisibleNodes(
  nodes: readonly RepositoryDiffTreeProjectionNode[],
  expandedSet: ReadonlySet<string>,
  parentId: string | null = null,
  depth = 0,
): readonly VisibleNode[] {
  return nodes.flatMap((node) => {
    const visibleNode: VisibleNode = { node, parentId, depth };
    if (!isExpandable(node) || !expandedSet.has(node.path)) {
      return [visibleNode];
    }
    return [
      visibleNode,
      ...flattenVisibleNodes(
        node.children.items,
        expandedSet,
        node.id,
        depth + 1,
      ),
    ];
  });
}

function isExpandable(node: RepositoryDiffTreeProjectionNode): boolean {
  return node.kind === "directory" && node.entryKind !== "submodule";
}

const CHANGE_LABELS: Readonly<Record<FileChangeStatus, string>> = {
  added: "追加",
  modified: "変更",
  deleted: "削除",
  renamed: "名前変更",
  copied: "コピー",
  typeChanged: "種別変更",
  untracked: "未追跡",
};

const CHANGE_TOKENS = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  typeChanged: "T",
  untracked: "U",
} as const satisfies Readonly<Record<FileChangeStatus, string>>;

function getNodeLabel(node: RepositoryDiffTreeProjectionNode): string {
  if (node.ignored) {
    return "無視";
  }
  if (node.contentClassification === "binary") {
    return "バイナリ";
  }
  if (node.entryKind === "submodule") {
    return "サブモジュール";
  }
  if (node.change === null) {
    return "変更なし";
  }
  return CHANGE_LABELS[node.change];
}

function getNodeToken(node: RepositoryDiffTreeProjectionNode): string {
  if (node.ignored) {
    return "I";
  }
  if (node.contentClassification === "binary") {
    return "B";
  }
  if (node.entryKind === "submodule") {
    return "S";
  }
  if (node.change === null) {
    return "—";
  }
  return CHANGE_TOKENS[node.change];
}
