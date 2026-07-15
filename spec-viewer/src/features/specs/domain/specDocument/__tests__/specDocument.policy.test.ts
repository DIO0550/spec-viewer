import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import {
  DocumentIdentity,
  SpecDocument,
  SpecDocumentPolicy,
} from "@/features/specs/domain/specDocument";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const reviewableSpec = { reviewable: true, archiveable: true } as const;
const sourceGroup = { reviewable: false, archiveable: false } as const;

test("SpecDocumentはmissing・empty・Markdown・HTMLを不正なfield組合せなしで復元する", () => {
  const missing = SpecDocument.missing({
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec/tasks.md",
  });
  const empty = SpecDocument.loaded({
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec/tasks.md",
    contents: " \n\t ",
    blocks: [],
  });
  const markdown = SpecDocument.loaded({
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec/tasks.md",
    contents: "# Tasks",
    blocks: [],
  });
  const html = SpecDocument.loaded({
    key: "requirements",
    format: "html",
    path: "/workspace/spec/custom-preview.html",
    contents: "<main>Requirements</main>",
    allowsScripts: true,
  });

  expect(missing).toEqual({
    kind: "missing",
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec/tasks.md",
  });
  expect(empty).toEqual({
    kind: "empty",
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec/tasks.md",
  });
  expect(markdown).toEqual({
    kind: "markdown",
    key: "tasks",
    path: "/workspace/spec/tasks.md",
    contents: "# Tasks",
    blocks: [],
  });
  expect(html).toEqual({
    kind: "html",
    key: "requirements",
    path: "/workspace/spec/custom-preview.html",
    contents: "<main>Requirements</main>",
    allowsScripts: true,
  });
});

test.each([
  [
    SpecDocument.missing({
      key: "tasks",
      format: "markdown",
      path: "/workspace/spec/tasks.md",
    }),
    {
      readability: "immediate",
      commentable: true,
      preview: "none",
      allowsScripts: false,
    },
  ],
  [
    SpecDocument.loaded({
      key: "tasks",
      format: "markdown",
      path: "/workspace/spec/tasks.md",
      contents: "",
      blocks: [],
    }),
    {
      readability: "immediate",
      commentable: true,
      preview: "none",
      allowsScripts: false,
    },
  ],
  [
    SpecDocument.loaded({
      key: "tasks",
      format: "markdown",
      path: "/workspace/spec/tasks.md",
      contents: "# Tasks",
      blocks: [],
    }),
    {
      readability: "afterRender",
      commentable: true,
      preview: "markdown",
      allowsScripts: false,
    },
  ],
  [
    SpecDocument.loaded({
      key: "requirements",
      format: "html",
      path: "/workspace/spec/custom-preview.html",
      contents: "<main>Requirements</main>",
      allowsScripts: true,
    }),
    {
      readability: "afterRender",
      commentable: false,
      preview: "html",
      allowsScripts: true,
    },
  ],
] as const)("SpecDocumentPolicyはvariantごとのreadability・commentability・preview・script capabilityを返す", (document, expected) => {
  expect(SpecDocumentPolicy.capabilities(document, reviewableSpec)).toEqual(
    expected,
  );
});

test("SpecDocumentPolicyはbackend由来のnode capabilityでcommentabilityを無効化する", () => {
  const markdown = SpecDocument.loaded({
    key: "tasks",
    format: "markdown",
    path: "/workspace/spec/tasks.md",
    contents: "# Tasks",
    blocks: [],
  });

  expect(
    SpecDocumentPolicy.capabilities(markdown, sourceGroup).commentable,
  ).toBe(false);
});

test("DocumentIdentityは区切り文字を含む値でも構造的に比較して衝突しない", () => {
  const first = DocumentIdentity.create({
    workspacePath: WorkspacePath.fromString("a"),
    specId: TestValues.specId("b"),
    fileKey: "requirements",
    loadRevision: "tasks\u0000revision-2",
  });
  const second = DocumentIdentity.create({
    workspacePath: WorkspacePath.fromString("a\u0000b"),
    specId: TestValues.specId("requirements"),
    fileKey: "tasks",
    loadRevision: "revision-2",
  });

  expect(DocumentIdentity.equals(first, second)).toBe(false);
  expect(DocumentIdentity.equals(first, { ...first })).toBe(true);
});
