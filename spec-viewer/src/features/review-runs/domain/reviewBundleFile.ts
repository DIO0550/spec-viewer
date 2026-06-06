import type { SpecFileKey } from "@/features/specs/types/spec";

export type ReviewBundleFileKind =
  | "manifest"
  | "status"
  | "instructions"
  | "comments"
  | "contextSource";

export type RawReviewBundleFile = Readonly<{
  kind: ReviewBundleFileKind;
  relativePath: string;
  contents: string;
  specId?: string;
  fileKey?: SpecFileKey;
}>;

export type ReviewBundleManifestFile = Readonly<{
  kind: "manifest";
  relativePath: string;
  contents: string;
}>;

export type ReviewBundleStatusFile = Readonly<{
  kind: "status";
  relativePath: string;
  contents: string;
}>;

export type ReviewBundleInstructionsFile = Readonly<{
  kind: "instructions";
  relativePath: string;
  contents: string;
}>;

export type ReviewBundleCommentsFile = Readonly<{
  kind: "comments";
  relativePath: string;
  contents: string;
}>;

export type ReviewBundleContextSourceFile = Readonly<{
  kind: "contextSource";
  relativePath: string;
  contents: string;
  specId: string;
  fileKey: SpecFileKey;
}>;

export type ParsedReviewBundleFile =
  | ReviewBundleManifestFile
  | ReviewBundleStatusFile
  | ReviewBundleInstructionsFile
  | ReviewBundleCommentsFile
  | ReviewBundleContextSourceFile;

export const ReviewBundleFile = {
  /**
   * @param input - Raw bundle file metadata and contents.
   * @returns Parsed bundle file variant for the provided kind.
   * @throws Error when context source metadata is incomplete.
   */
  parse(input: RawReviewBundleFile): ParsedReviewBundleFile {
    if (input.kind === "contextSource") {
      return parseContextSourceFile(input);
    }

    return {
      kind: input.kind,
      relativePath: input.relativePath,
      contents: input.contents,
    };
  },
} as const;

/** @returns Context source variant with required spec identity metadata. */
function parseContextSourceFile(
  input: RawReviewBundleFile,
): ReviewBundleContextSourceFile {
  if (input.specId === undefined || input.fileKey === undefined) {
    throw new Error(
      `Context source review bundle file requires specId and fileKey: ${input.relativePath}`,
    );
  }

  return {
    kind: "contextSource",
    relativePath: input.relativePath,
    contents: input.contents,
    specId: input.specId,
    fileKey: input.fileKey,
  };
}
