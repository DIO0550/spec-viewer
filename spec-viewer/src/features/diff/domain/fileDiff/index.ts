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

export type FileDiff = Readonly<{
  specId: string;
  fileKey: string;
  review: FileReview;
}>;

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
