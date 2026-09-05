import { expect, test } from "vitest";

import { SpecArtifact } from "@/features/specs/domain/specArtifact";

const standardArtifact = {
  identity: { kind: "standard", fileKey: "tasks" },
} as const;

const directArtifact = {
  identity: { kind: "directMarkdown", fileName: "Notes.md" },
} as const;

test("stableIdはstandardとdirect Markdownを衝突しないIDへ変換する", () => {
  expect(SpecArtifact.stableId(standardArtifact.identity)).toBe(
    "standard:tasks",
  );
  expect(SpecArtifact.stableId(directArtifact.identity)).toBe(
    "directMarkdown:Notes.md",
  );
});

test("fixedFileKeyはstandardだけにfixed keyを返す", () => {
  expect(SpecArtifact.fixedFileKey(standardArtifact.identity)).toBe("tasks");
  expect(SpecArtifact.fixedFileKey(directArtifact.identity)).toBeNull();
});

test("preserveOrFirstは空配列ならnull、選択なしなら先頭identityを返す", () => {
  expect(SpecArtifact.preserveOrFirst([], null)).toBeNull();
  expect(
    SpecArtifact.preserveOrFirst([standardArtifact, directArtifact], null),
  ).toEqual(standardArtifact.identity);
});

test("preserveOrFirstはexact-caseで一致するunknown artifactも維持する", () => {
  const unknownDirect = {
    ...directArtifact,
    progress: "unknown",
    error: { code: "markdownRead", message: "Could not read artifact." },
  } as const;

  expect(
    SpecArtifact.preserveOrFirst([standardArtifact, unknownDirect], {
      kind: "directMarkdown",
      fileName: "Notes.md",
    }),
  ).toEqual(unknownDirect.identity);
});

test("preserveOrFirstはdirect Markdownの大文字小文字を同一視しない", () => {
  expect(
    SpecArtifact.preserveOrFirst([standardArtifact, directArtifact], {
      kind: "directMarkdown",
      fileName: "notes.md",
    }),
  ).toEqual(standardArtifact.identity);
});

test("preserveOrFirstは選択identity消失時に先頭へfallbackする", () => {
  expect(
    SpecArtifact.preserveOrFirst([directArtifact], {
      kind: "standard",
      fileKey: "tasks",
    }),
  ).toEqual(directArtifact.identity);
});
