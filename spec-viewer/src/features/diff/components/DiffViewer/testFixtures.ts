import type {
  DiffLineSource,
  FileChangeStatus,
  FileDiff,
  FileReview,
  OmissionReason,
  StructuredDiff,
} from "@/features/diff/domain/fileDiff";
import { Hunk } from "@/features/diff/domain/fileDiff";

export type DiffViewerFixtureOptions = Readonly<{
  status?: FileChangeStatus;
  lines?: readonly DiffLineSource[];
  omissionReason?: OmissionReason | null;
  oldContent?: string;
  newContent?: string;
  fileKey?: string;
}>;

/**
 * Creates a readonly FileDiff fixture for component tests and stories.
 *
 * @param options - Domain overrides for the scenario.
 * @returns A complete decoded FileDiff value.
 */
export function createDiffViewerFixture(
  options: DiffViewerFixtureOptions = {},
): FileDiff {
  const lines = options.lines ?? [
    { kind: "context", text: "const before = 1;" },
    { kind: "removed", text: "const first = before;" },
    { kind: "added", text: "const first = after;" },
    { kind: "context", text: "const middle = true;" },
    { kind: "removed", text: "const second = before;" },
    { kind: "added", text: "const second = after;" },
  ];
  const omissionReason = options.omissionReason ?? null;
  const structuredDiff: StructuredDiff =
    omissionReason === null
      ? {
          state: "available" as const,
          hunks:
            lines.length === 0
              ? []
              : [Hunk.fromLines("@@ -1,6 +1,6 @@", lines)],
          reason: null,
        }
      : {
          state: "omitted" as const,
          hunks: [],
          reason: omissionReason,
        };

  return {
    specId: "078-issue-167",
    fileKey: options.fileKey ?? "implementation-plan",
    review: {
      file: {
        oldPath: "implementation-plan.md",
        newPath: "implementation-plan.md",
        change: options.status ?? "modified",
        entryKind: "regular",
        contentClassification: omissionReason === "binary" ? "binary" : "text",
        similarity: null,
        oldMode: "100644",
        newMode: "100644",
      },
      oldContent: {
        state: "available",
        text: options.oldContent ?? lines.map((line) => line.text).join("\n"),
        reason: null,
        byteLength: null,
      },
      newContent: {
        state: "available",
        text: options.newContent ?? lines.map((line) => line.text).join("\n"),
        reason: null,
        byteLength: null,
      },
      patch: {
        state: "available",
        text: "",
        reason: null,
        byteLength: null,
      },
      structuredDiff,
      submodule: null,
    },
  };
}

/**
 * Creates a readonly FileReview fixture without any Spec-scoped identity.
 *
 * @param options - Domain overrides for the scenario.
 * @returns The review half of a complete decoded FileDiff value.
 */
export function createFileReviewFixture(
  options: DiffViewerFixtureOptions = {},
): FileReview {
  return createDiffViewerFixture(options).review;
}

/**
 * Creates a large changed review that exercises DOM windowing.
 *
 * @param lineCount - Number of source diff lines to generate.
 * @returns A FileReview with alternating removed and added lines.
 */
export function createLargeFileReviewFixture(lineCount = 20_000): FileReview {
  return createLargeDiffViewerFixture(lineCount).review;
}

/**
 * Creates a large changed diff that exercises DOM windowing.
 *
 * @param lineCount - Number of source diff lines to generate.
 * @returns A FileDiff with alternating removed and added lines.
 */
export function createLargeDiffViewerFixture(lineCount = 20_000): FileDiff {
  const lines: readonly DiffLineSource[] = Array.from(
    { length: lineCount },
    (_, index) => ({
      kind: index % 2 === 0 ? ("removed" as const) : ("added" as const),
      text: `const line${index} = ${index};`,
    }),
  );
  return createDiffViewerFixture({ lines });
}
