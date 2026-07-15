import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import {
  createDocumentIdentity,
  type DocumentReadiness,
  useDocumentReadiness,
} from "@/app/App/useDocumentReadiness";
import {
  type SpecDocumentState as SpecDocumentStateType,
  toSpecFeatureError,
} from "@/features/specs";
import { SpecDocument } from "@/features/specs/domain/specDocument";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type { SpecNodeCapabilities } from "@/features/specs/domain/specNode";
import * as TestValues from "@/shared/testing/validatedValueObjects";

const reviewable = { reviewable: true, archiveable: true } as const;
const notReviewable = { reviewable: false, archiveable: false } as const;
const markdownDocument = SpecDocument.loaded({
  key: "tasks",
  format: "markdown",
  path: "/workspace/spec-reviewer/tasks.md",
  contents: "# Tasks",
  blocks: [],
});
const htmlDocument = SpecDocument.loaded({
  key: "requirements",
  format: "html",
  path: "/workspace/spec-reviewer/custom-preview.html",
  contents: "<main>Requirements</main>",
  allowsScripts: true,
});
const missingDocument = SpecDocument.missing({
  key: "tasks",
  format: "markdown",
  path: "/workspace/spec-reviewer/tasks.md",
});
const emptyDocument = SpecDocument.loaded({
  key: "tasks",
  format: "markdown",
  path: "/workspace/spec-reviewer/tasks.md",
  contents: "  ",
  blocks: [],
});

type HookResult = Readonly<{
  current: DocumentReadiness;
  unmount: () => void;
}>;

function renderDocumentReadiness(
  state: SpecDocumentStateType,
  nodeCapabilities: SpecNodeCapabilities = reviewable,
): HookResult {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as unknown as DocumentReadiness };

  function TestComponent(): null {
    result.current = useDocumentReadiness(state, nodeCapabilities);
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

test("createDocumentIdentityはtyped selectionとload revisionを構造のまま保持する", () => {
  const state = SpecDocumentState.loaded(
    "/workspace/spec-reviewer",
    TestValues.specId("phase-1"),
    markdownDocument,
    { loadRevision: "load-1", correlationId: "corr-1" },
  );

  expect(createDocumentIdentity(state)).toEqual({
    workspacePath: "/workspace/spec-reviewer",
    specId: TestValues.specId("phase-1"),
    fileKey: "tasks",
    loadRevision: "load-1",
  });
});

test("useDocumentReadinessはMarkdownのrender ackまでreadabilityを待つ", () => {
  const state = SpecDocumentState.loaded(
    "/workspace/spec-reviewer",
    TestValues.specId("phase-1"),
    markdownDocument,
    { loadRevision: "load-1" },
  );
  const result = renderDocumentReadiness(state);

  expect(result.current.isDocumentReadable).toBe(false);
  expect(result.current.isDocumentCommentable).toBe(true);

  act(() => {
    result.current.markCurrentDocumentReadable();
  });

  expect(result.current.isDocumentReadable).toBe(true);
  result.unmount();
});

test.each([
  [missingDocument, true, true],
  [emptyDocument, true, true],
  [htmlDocument, false, false],
] as const)("useDocumentReadinessはdocument variantのpolicyを返す", (document, expectedReadable, expectedCommentable) => {
  const state = SpecDocumentState.loaded(
    "/workspace/spec-reviewer",
    TestValues.specId("phase-1"),
    document,
    { loadRevision: "load-1" },
  );
  const result = renderDocumentReadiness(state);

  expect(result.current.isDocumentReadable).toBe(expectedReadable);
  expect(result.current.isDocumentCommentable).toBe(expectedCommentable);
  result.unmount();
});

test("useDocumentReadinessはnodeがreviewableでない場合にMarkdownコメントを無効化する", () => {
  const state = SpecDocumentState.loaded(
    "/workspace/spec-reviewer",
    TestValues.specId("source-group"),
    markdownDocument,
    { loadRevision: "load-1" },
  );
  const result = renderDocumentReadiness(state, notReviewable);

  expect(result.current.isDocumentCommentable).toBe(false);
  result.unmount();
});

test("useDocumentReadinessはload失敗時にreadableでもcommentableでもない", () => {
  const state = SpecDocumentState.failed(
    "/workspace/spec-reviewer",
    TestValues.specId("phase-1"),
    "tasks",
    toSpecFeatureError("read", new Error("failed")),
  );
  const result = renderDocumentReadiness(state);

  expect(result.current.documentIdentity).toBeNull();
  expect(result.current.isDocumentReadable).toBe(false);
  expect(result.current.isDocumentCommentable).toBe(false);
  result.unmount();
});
