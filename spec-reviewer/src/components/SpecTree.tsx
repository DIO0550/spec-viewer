import { RefreshCcw } from "lucide-react";

import type { SpecTreeState } from "../hooks/useSpecs";
import type { SpecNode } from "../types/spec";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

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
        title="No workspace"
        description="Load a workspace to see available specs."
        variant="inline"
      />
    );
  }

  if (state.status === "loading") {
    return (
      <section className="spec-tree__status" aria-live="polite" role="status">
        <h2>Specs</h2>
        <p>Scanning spec files...</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <ErrorState
        title="Could not load specs"
        message={state.error.message}
        actionLabel="Retry"
        onAction={onReload}
      />
    );
  }

  if (state.status === "empty") {
    return (
      <EmptyState
        title="No specs found"
        description="This workspace does not contain configured spec files yet."
        action={
          <button
            className="button button--secondary"
            type="button"
            onClick={onReload}
          >
            <RefreshCcw aria-hidden="true" size={16} />
            Refresh
          </button>
        }
        variant="inline"
      />
    );
  }

  return (
    <nav className="spec-tree" aria-label="Spec tree">
      <div className="spec-tree__header">
        <h2>Specs</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Refresh spec tree"
          title="Refresh spec tree"
          onClick={onReload}
        >
          <RefreshCcw aria-hidden="true" size={16} />
        </button>
      </div>
      <ul className="spec-tree__list">
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
        aria-current={isSelected ? "page" : undefined}
        style={{
          paddingInlineStart:
            BASE_TREE_ITEM_INDENT + depth * TREE_ITEM_INDENT_STEP,
        }}
        onClick={() => {
          onSelectSpec(node.id);
        }}
      >
        <span>{node.label}</span>
        <span className="spec-tree__file-count">{node.files.length}</span>
      </button>
      {node.children.length === 0 ? null : (
        <ul className="spec-tree__list">
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
