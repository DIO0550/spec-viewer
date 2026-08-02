import { expect, test } from "vitest";

import type {
  FileChangeStatus,
  FileDiff,
  OmissionReason,
} from "@/features/diff/domain/fileDiff";
import { buildDiffViewModel } from "@/features/diff/lib/diffViewModel";

test.each([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typeChanged",
  "untracked",
] satisfies readonly FileChangeStatus[])("%s statusを表示labelへ写像する", (status) => {
  const model = buildDiffViewModel(createAvailableFileDiff(status));

  expect(model.status.change).toBe(status);
  expect(model.status.label.length).toBeGreaterThan(0);
});

test("availableでhunksが空ならempty modelにする", () => {
  const model = buildDiffViewModel(createAvailableFileDiff("modified"));

  expect(model.state).toBe("empty");
  expect(model.omissionReason).toBeNull();
});

test.each([
  "binary",
  "largeFile",
  "diffLimit",
  "missingSide",
  "unsupportedEntryKind",
] satisfies readonly OmissionReason[])("%s omitted reasonを保持する", (reason) => {
  const model = buildDiffViewModel(createOmittedFileDiff(reason));

  expect(model.state).toBe("omitted");
  expect(model.omissionReason).toBe(reason);
  expect(model.inlineRows).toEqual([]);
  expect(model.sideBySideRows).toEqual([]);
});

function createAvailableFileDiff(change: FileChangeStatus): FileDiff {
  return createFileDiff(change, {
    state: "available",
    hunks: [],
    reason: null,
  });
}

function createOmittedFileDiff(reason: OmissionReason): FileDiff {
  return createFileDiff("modified", { state: "omitted", hunks: [], reason });
}

function createFileDiff(
  change: FileChangeStatus,
  structuredDiff: FileDiff["review"]["structuredDiff"],
): FileDiff {
  return {
    specId: "078-issue-167",
    fileKey: "implementation-plan",
    review: {
      file: {
        oldPath: "implementation-plan.md",
        newPath: "implementation-plan.md",
        change,
        entryKind: "regular",
        contentClassification: "text",
        similarity: null,
        oldMode: "100644",
        newMode: "100644",
      },
      oldContent: {
        state: "available",
        text: "",
        reason: null,
        byteLength: null,
      },
      newContent: {
        state: "available",
        text: "",
        reason: null,
        byteLength: null,
      },
      patch: { state: "available", text: "", reason: null, byteLength: null },
      structuredDiff,
      submodule: null,
    },
  };
}
