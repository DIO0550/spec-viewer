import { expect, test } from "vitest";

import { SpecTreeState } from "@/features/specs/domain/specTreeState";
import type { SpecNode } from "@/features/specs/types/spec";

const specNode: SpecNode = {
  id: "spec",
  label: "spec",
  files: [],
  children: [],
};

test("fromTreeはspecがあるときready状態を返す", () => {
  const state = SpecTreeState.fromTree({
    workspacePath: "/workspace",
    tree: { specs: [specNode] },
  });

  expect(state.status).toBe("ready");
  expect(state.tree?.specs).toHaveLength(1);
});

test("fromTreeはspecが無いときempty状態を返す", () => {
  const state = SpecTreeState.fromTree({
    workspacePath: "/workspace",
    tree: { specs: [] },
  });

  expect(state.status).toBe("empty");
});
