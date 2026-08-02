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
    estimatedHeight: 28,
  };
}

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
