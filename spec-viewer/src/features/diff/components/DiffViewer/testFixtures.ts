import type {
  ContentClassification,
  DiffLineSource,
  FileChangeStatus,
  FileContent,
  FileDiff,
  FileReview,
  OmissionReason,
  StructuredDiff,
} from "@/features/diff/domain/fileDiff";
import { deriveDiffAvailability, Hunk } from "@/features/diff/domain/fileDiff";

export type DiffViewerFixtureOptions = Readonly<{
  status?: FileChangeStatus;
  lines?: readonly DiffLineSource[];
  omissionReason?: OmissionReason | null;
  oldContent?: string;
  newContent?: string;
  fileKey?: string;
  oldPath?: string | null;
  newPath?: string | null;
  contentClassification?: ContentClassification;
  hunks?: readonly Hunk[];
}>;

/**
 * Creates a readonly generic FileDiff fixture for component tests and stories.
 *
 * @param options - Domain overrides for the scenario.
 * @returns A complete source-independent FileDiff value.
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
  const status = options.status ?? "modified";
  const omissionReason = options.omissionReason ?? null;
  const isAdded = status === "added" || status === "untracked";
  const isDeleted = status === "deleted";
  const contentClassification =
    options.contentClassification ??
    (omissionReason === "binary" ? "binary" : "text");
  const oldPath =
    options.oldPath ?? (isAdded ? null : "implementation-plan.md");
  const newPath =
    options.newPath ?? (isDeleted ? null : "implementation-plan.md");
  const structuredDiff: StructuredDiff =
    omissionReason === null
      ? {
          state: "available",
          hunks:
            options.hunks ??
            (lines.length === 0
              ? []
              : [Hunk.fromLines("@@ -1,6 +1,6 @@", lines)]),
          reason: null,
        }
      : {
          state: "omitted",
          hunks: [],
          reason: omissionReason,
        };
  const review: FileReview = {
    file: {
      oldPath,
      newPath,
      change: status,
      entryKind: "regular",
      contentClassification,
      similarity: null,
      oldMode: isAdded ? null : "100644",
      newMode: isDeleted ? null : "100644",
    },
    oldContent: createFixtureContent(
      options.oldContent,
      isAdded,
      lines.map((line) => line.text).join("\n"),
    ),
    newContent: createFixtureContent(
      options.newContent,
      isDeleted,
      lines.map((line) => line.text).join("\n"),
    ),
    patch:
      omissionReason === null
        ? availableContent("")
        : omittedContent(omissionReason),
    structuredDiff,
    submodule: null,
  };

  return {
    identity: {
      sourceId: "spec:078-issue-167",
      path: options.fileKey ?? "implementation-plan",
    },
    review,
    availability: deriveDiffAvailability(review),
  };
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

/**
 * Creates an available fixture side or the expected missing side marker.
 *
 * @param text - Explicit fixture text, when supplied.
 * @param missing - Whether this side is absent for a one-sided file.
 * @param fallbackText - Text used when the side is available by default.
 * @returns A decoded file content fixture.
 */
function createFixtureContent(
  text: string | undefined,
  missing: boolean,
  fallbackText: string,
): FileContent {
  if (text !== undefined) {
    return availableContent(text);
  }
  if (missing) {
    return omittedContent("missingSide");
  }
  return availableContent(fallbackText);
}

/**
 * Creates an available file content fixture.
 *
 * @param text - Content text.
 * @returns An available file content value.
 */
function availableContent(text: string): FileContent {
  return { state: "available", text, reason: null, byteLength: null };
}

/**
 * Creates an omitted file content fixture.
 *
 * @param reason - The reason the content cannot be rendered.
 * @returns An omitted file content value.
 */
function omittedContent(reason: OmissionReason): FileContent {
  return { state: "omitted", text: null, reason, byteLength: null };
}
