import { expect, test } from "vitest";

import { ReviewBundleFile } from "@/features/review-runs/domain/reviewBundleFile";
import type { ReviewBundleFileKind } from "@/features/review-runs/domain/reviewBundleFile";

test.each<ReviewBundleFileKind>([
  "manifest",
  "status",
  "instructions",
  "comments",
])("ReviewBundleFile.parseは%s fileを同じkindで返す", (kind) => {
  const result = ReviewBundleFile.parse({
    kind,
    relativePath: `${kind}.json`,
    contents: "{}",
  });

  expect(result.kind).toBe(kind);
  expect(result.relativePath).toBe(`${kind}.json`);
});

test("ReviewBundleFile.parseはcontextSource metadataを保持する", () => {
  const result = ReviewBundleFile.parse({
    kind: "contextSource",
    relativePath: "context/auth/tasks.md",
    contents: "# Tasks",
    specId: "auth",
    fileKey: "tasks",
  });

  expect(result).toEqual({
    kind: "contextSource",
    relativePath: "context/auth/tasks.md",
    contents: "# Tasks",
    specId: "auth",
    fileKey: "tasks",
  });
});

test("ReviewBundleFile.parseはcontextSource metadata不足を拒否する", () => {
  expect(() =>
    ReviewBundleFile.parse({
      kind: "contextSource",
      relativePath: "context/auth/tasks.md",
      contents: "# Tasks",
    }),
  ).toThrow("Context source review bundle file requires specId and fileKey");
});
