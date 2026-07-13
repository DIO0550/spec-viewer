import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import {
  ReviewBundleContextSourceFile,
  ReviewBundleFile,
} from "@/features/review-runs/domain/reviewBundleFile";
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
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });

  expect(result).toEqual({
    kind: "contextSource",
    relativePath: "context/auth/tasks.md",
    contents: "# Tasks",
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });
});

test("ReviewBundleContextSourceFile.parseはcontextSource metadataを保持する", () => {
  const result = ReviewBundleContextSourceFile.parse({
    kind: "contextSource",
    relativePath: "context/auth/tasks.md",
    contents: "# Tasks",
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });

  expect(result.specId).toBe("auth");
  expect(result.fileKey).toBe("tasks");
});

test("ReviewBundleContextSourceFile.parseはcontextSource metadata不足を拒否する", () => {
  expect(() =>
    ReviewBundleContextSourceFile.parse({
      kind: "contextSource",
      relativePath: "context/auth/tasks.md",
      contents: "# Tasks",
    }),
  ).toThrow("Context source review bundle file requires specId and fileKey");
});
