import { expect, test } from "vitest";

import {
  createSpecTreePresentationState,
  isSpecTreeNodeExpanded,
  pruneSpecTreeExpansion,
  revealSpecTreeDestination,
  specNodeIdentityKey,
  toggleSpecTreeNode,
} from "@/features/specs/domain/specTreePresentation";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";

const archivedSpec = createSpecNodeFixture({
  id: "primary/.archive/auth",
  label: "Auth",
  sourceGroupId: "primary",
  relativeId: ".archive/auth",
});
const archive = createSpecNodeFixture({
  id: "primary/.archive",
  label: "Archive",
  kind: "archive",
  sourceGroupId: "primary",
  relativeId: ".archive",
  children: [archivedSpec],
});
const secondaryArchivedSpec = createSpecNodeFixture({
  id: "secondary/.archive/auth",
  label: "Auth",
  sourceGroupId: "secondary",
  relativeId: ".archive/auth",
});
const secondaryArchive = createSpecNodeFixture({
  id: "secondary/.archive",
  label: "Archive",
  kind: "archive",
  sourceGroupId: "secondary",
  relativeId: ".archive",
  children: [secondaryArchivedSpec],
});
const sourceGroup = createSpecNodeFixture({
  id: "secondary",
  label: "Secondary",
  kind: "sourceGroup",
  sourceGroupId: "secondary",
  relativeId: ".",
  children: [secondaryArchive],
});
const tree = { specs: [archive, sourceGroup] } as const;

test.each([
  ["initial load", "/workspace", 1],
  ["workspace switch", "/other", 2],
  ["reload generation", "/workspace", 3],
] as const)("%sはArchiveをcollapsedへresetする", (_name, workspacePath, generation) => {
  const state = createSpecTreePresentationState(workspacePath, generation);

  expect(state.expandedNodeKeys.size).toBe(0);
  expect(state.revealTarget).toBeNull();
});

test("success revealはdestinationのcontainer ancestorsだけを展開する", () => {
  const state = createSpecTreePresentationState("/workspace", 1);
  const revealed = revealSpecTreeDestination(state, tree, {
    workspacePath: "/workspace",
    loadGeneration: 1,
    target: {
      sourceGroupId: "secondary",
      relativeId: ".archive/auth",
    },
  });

  expect(isSpecTreeNodeExpanded(revealed, sourceGroup)).toBe(true);
  expect(isSpecTreeNodeExpanded(revealed, secondaryArchive)).toBe(true);
  expect(isSpecTreeNodeExpanded(revealed, archive)).toBe(false);
  expect(revealed.revealTarget).toEqual({
    sourceGroupId: "secondary",
    relativeId: ".archive/auth",
  });
});

test.each([
  ["missing destination", "/workspace", 1, "missing"],
  ["other workspace", "/other", 1, ".archive/auth"],
  ["stale generation", "/workspace", 2, ".archive/auth"],
] as const)("%sのrevealを無視する", (_name, workspacePath, generation, relativeId) => {
  const state = createSpecTreePresentationState("/workspace", 1);
  const next = revealSpecTreeDestination(state, tree, {
    workspacePath,
    loadGeneration: generation,
    target: { sourceGroupId: "primary", relativeId },
  });

  expect(next).toBe(state);
});

test("tree更新時に存在しないexpanded identityをpruneする", () => {
  const initial = createSpecTreePresentationState("/workspace", 1);
  const expanded = toggleSpecTreeNode(
    toggleSpecTreeNode(initial, archive),
    sourceGroup,
  );
  const pruned = pruneSpecTreeExpansion(expanded, { specs: [archive] });

  expect(pruned.expandedNodeKeys).toEqual(
    new Set([specNodeIdentityKey(archive)]),
  );
});
