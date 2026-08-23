import type { DiffLineKind } from "@/features/diff/domain/fileDiff";
import type { DiffViewRow } from "@/features/diff/lib/diffViewModel";

/**
 * Creates a line-ending annotation associated with the preceding content side.
 *
 * @param input - Stable position, text and preceding line kind.
 * @returns A non-content annotation row without line numbers or change ID.
 */
export function createAnnotationRow(
  input: Readonly<{
    hunkIndex: number;
    lineIndex: number;
    text: string;
    previousKind: DiffLineKind | null;
  }>,
): DiffViewRow {
  return {
    kind: "annotation",
    id: `hunk-${input.hunkIndex}-annotation-${input.lineIndex}`,
    side: resolveAnnotationSide(input.previousKind),
    text: input.text,
    estimatedHeight: 30,
  };
}

/**
 * Determines which side an end-of-file annotation belongs to, based on the kind of the line
 * that immediately preceded it in the hunk.
 *
 * @param previousKind - The kind of the line preceding the annotation, or null if it is first.
 * @returns `"old"` when the preceding line was removed, `"new"` when it was added, otherwise `"both"`.
 */
function resolveAnnotationSide(
  previousKind: DiffLineKind | null,
): "old" | "new" | "both" {
  if (previousKind === "removed") {
    return "old";
  }
  if (previousKind === "added") {
    return "new";
  }

  return "both";
}
