import { useCallback, useEffect, useState } from "react";

import { SpecTreeView } from "@/features/specs/domain/specTreeView";
import type { SpecTreeState } from "@/features/specs/hooks/useSpecs";

type UseSpecTreeExpansionResult = Readonly<{
  expandedSpecIds: ReadonlySet<string>;
  /** @param specId - Spec whose expansion should flip */
  toggleExpanded: (specId: string) => void;
}>;

/**
 * Keeps ancestors of the selected spec expanded while the tree changes.
 *
 * @param state - Current spec tree state.
 * @param selectedSpecId - Currently selected spec id, or null.
 * @returns Expanded spec ids and the expansion toggle.
 */
export function useSpecTreeExpansion(
  state: SpecTreeState,
  selectedSpecId: string | null,
): UseSpecTreeExpansionResult {
  const [expandedSpecIds, setExpandedSpecIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (state.status !== "ready" || selectedSpecId === null) {
      return;
    }

    const ancestorIds = SpecTreeView.ancestorSpecIds(
      state.tree.specs,
      selectedSpecId,
    );

    if (ancestorIds.length === 0) {
      return;
    }

    setExpandedSpecIds((currentIds) =>
      SpecTreeView.withExpanded(currentIds, ancestorIds),
    );
  }, [selectedSpecId, state]);

  const toggleExpanded = useCallback((specId: string): void => {
    setExpandedSpecIds((currentIds) =>
      SpecTreeView.toggleExpanded(currentIds, specId),
    );
  }, []);

  return { expandedSpecIds, toggleExpanded };
}
