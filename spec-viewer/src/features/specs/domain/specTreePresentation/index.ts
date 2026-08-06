import type {
  SpecNode,
  SpecNodeIdentity,
} from "@/features/specs/domain/specNode";
import {
  SpecTree,
  type SpecTree as SpecTreeType,
} from "@/features/specs/domain/specTree";

export type SpecTreePresentationState = Readonly<{
  workspacePath: string | null;
  loadGeneration: number;
  expandedNodeKeys: ReadonlySet<string>;
  revealTarget: SpecNodeIdentity | null;
}>;

export type SpecTreeRevealRequest = Readonly<{
  workspacePath: string;
  loadGeneration: number;
  target: SpecNodeIdentity;
}>;

/** Creates an opaque key for one source-group-relative node identity. */
export function specNodeIdentityKey(identity: SpecNodeIdentity): string {
  return JSON.stringify([identity.sourceGroupId, identity.relativeId]);
}

/** Creates collapsed presentation state for a load generation. */
export function createSpecTreePresentationState(
  workspacePath: string | null,
  loadGeneration: number,
): SpecTreePresentationState {
  return {
    workspacePath,
    loadGeneration,
    expandedNodeKeys: new Set(),
    revealTarget: null,
  };
}

/** Toggles one container without mutating the current expansion set. */
export function toggleSpecTreeNode(
  state: SpecTreePresentationState,
  identity: SpecNodeIdentity,
): SpecTreePresentationState {
  const key = specNodeIdentityKey(identity);
  const expandedNodeKeys = new Set(state.expandedNodeKeys);

  if (expandedNodeKeys.has(key)) {
    expandedNodeKeys.delete(key);
  } else {
    expandedNodeKeys.add(key);
  }

  return { ...state, expandedNodeKeys };
}

/** Reveals a destination only when workspace and load generation still match. */
export function revealSpecTreeDestination(
  state: SpecTreePresentationState,
  tree: SpecTreeType,
  request: SpecTreeRevealRequest,
): SpecTreePresentationState {
  if (
    state.workspacePath !== request.workspacePath ||
    state.loadGeneration !== request.loadGeneration
  ) {
    return state;
  }

  const path = SpecTree.findPathToNode(tree, request.target);

  if (path.length === 0) {
    return state;
  }

  const expandedNodeKeys = new Set(state.expandedNodeKeys);

  path.slice(0, -1).forEach((node) => {
    if (node.children.length > 0) {
      expandedNodeKeys.add(specNodeIdentityKey(node));
    }
  });

  return {
    ...state,
    expandedNodeKeys,
    revealTarget: request.target,
  };
}

/** Removes expansion keys that no longer exist in the authoritative tree. */
export function pruneSpecTreeExpansion(
  state: SpecTreePresentationState,
  tree: SpecTreeType,
): SpecTreePresentationState {
  const existingKeys = collectNodeKeys(tree.specs);
  const expandedNodeKeys = new Set(
    [...state.expandedNodeKeys].filter((key) => existingKeys.has(key)),
  );

  return { ...state, expandedNodeKeys };
}

/** Returns whether one node is expanded in the presentation state. */
export function isSpecTreeNodeExpanded(
  state: SpecTreePresentationState,
  identity: SpecNodeIdentity,
): boolean {
  return state.expandedNodeKeys.has(specNodeIdentityKey(identity));
}

/** Collects composite node keys once for expansion pruning. */
function collectNodeKeys(nodes: readonly SpecNode[]): ReadonlySet<string> {
  const keys = new Set<string>();
  const visit = (candidates: readonly SpecNode[]): void => {
    candidates.forEach((node) => {
      keys.add(specNodeIdentityKey(node));
      visit(node.children);
    });
  };

  visit(nodes);
  return keys;
}
