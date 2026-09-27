import { expect, test } from "vitest";
import { SpecTree as SpecTreeDomain } from "@/features/specs/domain/specTree";
import { createSpecNodeFixture } from "@/features/specs/testing/specNodeFixture";
import type { SpecTree } from "@/features/specs/types/spec";

const tree: SpecTree = {
  specs: [
    createSpecNodeFixture({
      id: "079-issue-168",
      label: "Issue 168",
      files: [
        {
          key: "impl",
          label: "Implementation",
          fileName: "implementation-plan.md",
          status: "present",
        },
      ],
    }),
  ],
};

test("外部string keyを実在fileのSpecFileKeyへ絞る", () => {
  expect(
    SpecTreeDomain.resolveFileSelection(
      tree,
      "/workspace",
      "079-issue-168",
      "impl",
    ),
  ).toEqual({
    workspacePath: "/workspace",
    specId: "079-issue-168",
    fileKey: "impl",
  });
});

test.each([
  [null, "/workspace", "079-issue-168", "impl"],
  [tree, null, "079-issue-168", "impl"],
  [tree, "/workspace", "missing-spec", "impl"],
  [tree, "/workspace", "079-issue-168", "unknown-key"],
] as const)("未解決のworkspace/spec/fileはnullになる", (candidateTree, workspacePath, specId, fileKey) => {
  expect(
    SpecTreeDomain.resolveFileSelection(
      candidateTree,
      workspacePath,
      specId,
      fileKey,
    ),
  ).toBeNull();
});
