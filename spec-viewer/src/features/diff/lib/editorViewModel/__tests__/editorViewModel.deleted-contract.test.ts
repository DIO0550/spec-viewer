import { expect, test } from "vitest";

import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import { buildEditorViewModel } from "@/features/diff/lib/editorViewModel";

test("deletedでstructured diffが欠落した場合はold全文を推測せずinconsistentにする", () => {
  const base = createDiffViewerFixture({
    status: "deleted",
    oldContent: "deleted content",
  });
  const fileDiff = {
    ...base,
    review: {
      ...base.review,
      structuredDiff: {
        state: "omitted" as const,
        hunks: [] as const,
        reason: "diffLimit" as const,
      },
    },
    availability: { kind: "omitted" as const, reason: "diffLimit" as const },
  };

  const model = buildEditorViewModel(fileDiff);

  expect(model.state).toBe("inconsistent");
  expect(model.peeks).toEqual([]);
  expect(model.orderedChangeIds).toEqual([]);
});
