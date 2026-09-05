import { expect, test } from "vitest";
import { resolveCargoLeafName } from "../../../scripts/run-cargo-leaf.mjs";

const listed = [
  "infrastructure::git::tests::r199_git_018_committed: test",
  "infrastructure::git::tests::r199_git_019_staged: test",
].join("\n");

test("[R199-CARGO-001] suffixをfully-qualified test名へ解決する", () => {
  expect(resolveCargoLeafName(listed, "r199_git_018_committed")).toEqual({
    kind: "resolved",
    testName: "infrastructure::git::tests::r199_git_018_committed",
  });
});

test("[R199-CARGO-002] suffixが0件なら失敗する", () => {
  expect(resolveCargoLeafName(listed, "r199_git_999_missing")).toEqual({
    kind: "invalid",
    reason: "notFound",
  });
});

test("[R199-CARGO-003] suffixが複数件なら失敗する", () => {
  const ambiguous = [
    "a::r199_store_001_revision_zero: test",
    "b::r199_store_001_revision_zero: test",
  ].join("\n");
  expect(
    resolveCargoLeafName(ambiguous, "r199_store_001_revision_zero"),
  ).toEqual({
    kind: "invalid",
    reason: "ambiguous",
  });
});
