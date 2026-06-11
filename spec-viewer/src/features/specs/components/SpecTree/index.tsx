import { RefreshCcw } from "lucide-react";

import type { SpecTreeState } from "@/features/specs/hooks/useSpecs";
import { uiText } from "@/shared/lib/uiText";
import { CommandErrorDisplay } from "@/shared/ui/CommandErrorDisplay";
import { EmptyState } from "@/shared/ui/EmptyState";
import { LoadingSkeleton } from "@/shared/ui/LoadingSkeleton";

import { SpecTreeItem } from "./SpecTreeItem";
import { useSpecTreeExpansion } from "./useSpecTreeExpansion";

type Props = Readonly<{
  state: SpecTreeState;
  selectedSpecId: string | null;
  archivingSpecId?: string | null;
  /** @param specId - Identifier of the spec to select */
  onSelectSpec: (specId: string) => void;
  onArchiveSpec?: (specId: string) => void;
  /** Reloads the spec tree. */
  onReload: () => void;
}>;

/** @returns A navigable spec tree sidebar with loading, error, and empty states. */
export function SpecTree({
  state,
  selectedSpecId,
  archivingSpecId = null,
  onSelectSpec,
  onArchiveSpec,
  onReload,
}: Props) {
  const { expandedSpecIds, toggleExpanded } = useSpecTreeExpansion(
    state,
    selectedSpecId,
  );

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
      <div className="spec-tree__list" role="tree">
        {state.tree.specs.map((node) => (
          <SpecTreeItem
            key={node.id}
            node={node}
            depth={0}
            expandedSpecIds={expandedSpecIds}
            selectedSpecId={selectedSpecId}
            archivingSpecId={archivingSpecId}
            onSelectSpec={onSelectSpec}
            onArchiveSpec={onArchiveSpec}
            onToggleExpanded={toggleExpanded}
          />
        ))}
      </div>
    </nav>
  );
}
