import { expect, test } from "vitest";

import { ComparisonRevision } from "@/features/diff/domain/comparisonRevision";

test("comparison revisionはkindとcanonical identityで比較する", () => {
  const head = ComparisonRevision.head();
  const branch = { kind: "localBranch", name: "refs/heads/main" } as const;

  expect(ComparisonRevision.equals(head, ComparisonRevision.head())).toBe(true);
  expect(ComparisonRevision.equals(head, branch)).toBe(false);
  expect(ComparisonRevision.equals(branch, { ...branch })).toBe(true);
  expect(
    ComparisonRevision.equals(branch, { kind: "tag", name: branch.name }),
  ).toBe(false);
});

test.each([
  [ComparisonRevision.head(), "head"],
  [
    { kind: "commit", sha: "a".repeat(40) } as const,
    `commit:${"a".repeat(40)}`,
  ],
  [
    { kind: "localBranch", name: "refs/heads/feature/revision" } as const,
    "localBranch:refs/heads/feature/revision",
  ],
  [{ kind: "tag", name: "refs/tags/v1.0.0" } as const, "tag:refs/tags/v1.0.0"],
])("comparison revision idは衝突しない: %s", (revision, expected) => {
  expect(ComparisonRevision.idOf(revision)).toBe(expected);
});
