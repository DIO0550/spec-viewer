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
  /** Returns a deterministic, kind-qualified identity for rendering keys. */
  stableId(identity: SpecArtifactIdentity): string {
    return identity.kind === "standard"
      ? `standard:${identity.fileKey}`
      : `directMarkdown:${identity.fileName}`;
  },

  /** Returns the legacy fixed file key only for standard artifacts. */
  fixedFileKey(identity: SpecArtifactIdentity): SpecFileKey | null {
    return identity.kind === "standard" ? identity.fileKey : null;
  },

  /** Preserves an exact identity when present, otherwise selects the first item. */
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
