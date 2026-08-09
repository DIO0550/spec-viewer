export type FileChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "typeChanged"
  | "untracked";

export type DiffLineKind = "context" | "added" | "removed" | "noNewline";
export type EntryKind = "regular" | "symlink" | "submodule";
export type ContentClassification =
  | "text"
  | "binary"
  | "notApplicable"
  | "unknown";
export type OmissionReason =
  | "binary"
  | "largeFile"
  | "diffLimit"
  | "missingSide"
  | "unsupportedEntryKind";

export type DiffLineSource = Readonly<{
  kind: DiffLineKind;
  text: string;
}>;

export type DiffLine = Readonly<{
  kind: DiffLineKind;
  text: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}>;

export type Hunk = Readonly<{
  header: string;
  lines: readonly DiffLine[];
}>;

export type FileContent =
  | Readonly<{
      state: "available";
      text: string;
      reason: null;
      byteLength: null;
    }>
  | Readonly<{
      state: "omitted";
      text: null;
      reason: OmissionReason;
      byteLength: number | null;
    }>;

export type StructuredDiff =
  | Readonly<{
      state: "available";
      hunks: readonly Hunk[];
      reason: null;
    }>
  | Readonly<{
      state: "omitted";
      hunks: readonly [];
      reason: OmissionReason;
    }>;

export type FileChange = Readonly<{
  oldPath: string | null;
  newPath: string | null;
  change: FileChangeStatus;
  entryKind: EntryKind;
  contentClassification: ContentClassification;
  similarity: number | null;
  oldMode: string | null;
  newMode: string | null;
}>;

export type SubmoduleState = Readonly<{
  baseGitlinkOid: string | null;
  indexGitlinkOid: string | null;
  worktreeHeadOid: string | null;
  commitChanged: boolean;
  trackedChanges: boolean;
  untrackedChanges: boolean;
  uninitialized: boolean;
}>;

export type FileReview = Readonly<{
  file: FileChange;
  oldContent: FileContent;
  newContent: FileContent;
  patch: FileContent;
  structuredDiff: StructuredDiff;
  submodule: SubmoduleState | null;
}>;

export type DiffFileIdentity = Readonly<{
  sourceId: string;
  path: string;
}>;

export type FileDiffAvailability =
  | Readonly<{ kind: "ready" }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "omitted"; reason: OmissionReason }>
  | Readonly<{ kind: "missing"; side: "old" | "new" | "both" }>;

export type FileDiff = Readonly<{
  identity: DiffFileIdentity;
  review: FileReview;
  availability: FileDiffAvailability;
}>;

/**
 * Derives the display availability from a decoded review without depending on a source adapter.
 *
 * @param review - Decoded file review to classify.
 * @returns The safe top-level state for the diff viewer.
 */
export function deriveDiffAvailability(
  review: FileReview,
): FileDiffAvailability {
  if (review.file.contentClassification === "binary") {
    return { kind: "omitted", reason: "binary" };
  }

  if (review.structuredDiff.state === "omitted") {
    if (review.structuredDiff.reason === "missingSide") {
      return { kind: "missing", side: getMissingSide(review) ?? "both" };
    }

    return { kind: "omitted", reason: review.structuredDiff.reason };
  }

  const missingSide = getMissingSide(review);
  if (missingSide !== null && !isExpectedOneSidedMissing(review, missingSide)) {
    return { kind: "missing", side: missingSide };
  }

  if (review.structuredDiff.hunks.length === 0) {
    return { kind: "empty" };
  }

  return { kind: "ready" };
}

/**
 * Finds whether either content side is explicitly unavailable.
 *
 * @param review - Review whose old and new content states are inspected.
 * @returns The missing side, or null when both sides are available.
 */
function getMissingSide(review: FileReview): "old" | "new" | "both" | null {
  const oldMissing =
    review.oldContent.state === "omitted" &&
    review.oldContent.reason === "missingSide";
  const newMissing =
    review.newContent.state === "omitted" &&
    review.newContent.reason === "missingSide";

  if (oldMissing && newMissing) {
    return "both";
  }
  if (oldMissing) {
    return "old";
  }
  if (newMissing) {
    return "new";
  }

  return null;
}

/**
 * Keeps the expected missing side of a one-sided file renderable.
 *
 * @param review - Review carrying the file status and available counterpart.
 * @param side - Side reported as missing.
 * @returns True when the missing side is intrinsic to the file change.
 */
function isExpectedOneSidedMissing(
  review: FileReview,
  side: "old" | "new" | "both",
): boolean {
  if (side === "old") {
    return (
      (review.file.change === "added" || review.file.change === "untracked") &&
      review.newContent.state === "available"
    );
  }

  if (side === "new") {
    return (
      review.file.change === "deleted" &&
      review.oldContent.state === "available"
    );
  }

  return false;
}

const HUNK_HEADER_PATTERN =
  /^@@ -([0-9]+)(?:,([0-9]+))? \+([0-9]+)(?:,([0-9]+))? @@(?: .*)?$/;

/**
 * @param header - Unified diff hunk header.
 * @returns Parsed old and new starting line numbers.
 * @throws Error when the header violates the supported grammar.
 */
const parseHunkStartLines = (
  header: string,
): Readonly<{ oldStart: number; newStart: number }> => {
  const match = HUNK_HEADER_PATTERN.exec(header);
  if (!match) {
    throw new Error(`Invalid unified diff hunk header: ${header}`);
  }

  const oldStart = Number(match[1]);
  const oldCount = Number(match[2] ?? "1");
  const newStart = Number(match[3]);
  const newCount = Number(match[4] ?? "1");
  const rangeValues = [oldStart, oldCount, newStart, newCount];
  if (!rangeValues.every(Number.isSafeInteger)) {
    throw new Error(`Invalid unified diff hunk header: ${header}`);
  }

  const hasInvalidOldRange = oldStart === 0 && oldCount > 0;
  const hasInvalidNewRange = newStart === 0 && newCount > 0;
  if (hasInvalidOldRange || hasInvalidNewRange) {
    throw new Error(`Invalid unified diff hunk header: ${header}`);
  }

  return { oldStart, newStart };
};

/**
 * @param lines - Transport lines without line numbers.
 * @param oldStart - First old-side line number from the hunk header.
 * @param newStart - First new-side line number from the hunk header.
 * @returns New immutable line objects with derived line numbers.
 */
const createNumberedLines = (
  lines: readonly DiffLineSource[],
  oldStart: number,
  newStart: number,
): readonly DiffLine[] => {
  let oldLineNumber = oldStart;
  let newLineNumber = newStart;

  return lines.map((line) => {
    if (line.kind === "noNewline") {
      return { ...line, oldLineNumber: null, newLineNumber: null };
    }

    const currentOldLineNumber = line.kind === "added" ? null : oldLineNumber;
    const currentNewLineNumber = line.kind === "removed" ? null : newLineNumber;

    if (line.kind !== "added") {
      oldLineNumber += 1;
    }
    if (line.kind !== "removed") {
      newLineNumber += 1;
    }

    return {
      ...line,
      oldLineNumber: currentOldLineNumber,
      newLineNumber: currentNewLineNumber,
    };
  });
};

export const Hunk = {
  /**
   * @param header - Unified diff hunk header.
   * @param lines - Transport lines without derived line numbers.
   * @returns A readonly hunk with derived old and new line numbers.
   * @throws Error when the header does not match unified diff hunk syntax.
   */
  fromLines(header: string, lines: readonly DiffLineSource[]): Hunk {
    const { oldStart, newStart } = parseHunkStartLines(header);

    return {
      header,
      lines: createNumberedLines(lines, oldStart, newStart),
    };
  },
} as const;

export const StructuredDiff = {
  /**
   * @param value - Structured diff to inspect.
   * @returns True when Backend omitted the structured diff.
   */
  isOmitted(
    value: StructuredDiff,
  ): value is Extract<StructuredDiff, { state: "omitted" }> {
    return value.state === "omitted";
  },
} as const;
