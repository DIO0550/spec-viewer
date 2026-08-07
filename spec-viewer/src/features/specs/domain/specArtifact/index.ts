import type { SpecFileKey } from "@/features/specs/domain/specFile";

export type SpecArtifactIdentity =
  | Readonly<{ kind: "standard"; fileKey: SpecFileKey }>
  | Readonly<{ kind: "directMarkdown"; fileName: string }>;

export type SpecProgress =
  | "notStarted"
  | "inProgress"
  | "completed"
  | "unknown";

type ArtifactIdentityCarrier = Readonly<{
  identity: SpecArtifactIdentity;
}>;

/**
 * Compares two artifact identities for structural equality.
 * @param left - First identity to compare.
 * @param right - Second identity to compare.
 * @returns True when both identities share the same kind and matching kind-specific fields.
 */
function identitiesEqual(
  left: SpecArtifactIdentity,
  right: SpecArtifactIdentity,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "standard" && right.kind === "standard") {
    return left.fileKey === right.fileKey;
  }

  return (
    left.kind === "directMarkdown" &&
    right.kind === "directMarkdown" &&
    left.fileName === right.fileName
  );
}

export const SpecArtifact = {
  /**
   * Returns a deterministic, kind-qualified identity for rendering keys.
   * @param identity - Artifact identity to encode.
   * @returns `standard:<fileKey>` for standard artifacts, or `directMarkdown:<fileName>` otherwise.
   */
  stableId(identity: SpecArtifactIdentity): string {
    return identity.kind === "standard"
      ? `standard:${identity.fileKey}`
      : `directMarkdown:${identity.fileName}`;
  },

  /**
   * Returns the legacy fixed file key only for standard artifacts.
   * @param identity - Artifact identity to read.
   * @returns The file key for standard artifacts, or null for direct-markdown artifacts.
   */
  fixedFileKey(identity: SpecArtifactIdentity): SpecFileKey | null {
    return identity.kind === "standard" ? identity.fileKey : null;
  },

  /**
   * Preserves an exact identity when present, otherwise selects the first item.
   * @param artifacts - Artifact list to search, in display order.
   * @param preferred - Previously selected identity to preserve, or null when none.
   * @returns The preferred identity when it still exists among `artifacts`, otherwise the first
   * artifact's identity, or null when `artifacts` is empty.
   */
  preserveOrFirst(
    artifacts: readonly ArtifactIdentityCarrier[],
    preferred: SpecArtifactIdentity | null,
  ): SpecArtifactIdentity | null {
    if (preferred !== null) {
      const preserved = artifacts.find((artifact) =>
        identitiesEqual(artifact.identity, preferred),
      );

      if (preserved !== undefined) {
        return preserved.identity;
      }
    }

    return artifacts[0]?.identity ?? null;
  },
} as const;
