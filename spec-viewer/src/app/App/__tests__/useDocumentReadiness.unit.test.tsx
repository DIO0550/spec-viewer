import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  createDocumentReadableKey,
  type DocumentReadiness,
  useDocumentReadiness,
} from "@/app/App/useDocumentReadiness";
import type { SpecDocumentState as SpecDocumentStateType } from "@/features/specs";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";

const markdownDocument = {
  key: "tasks",
  format: "markdown",
  path: "/workspace/spec-reviewer/tasks.md",
  contents: "# Tasks",
  missing: false,
  blocks: [],
} as const;

const htmlDocument = {
  ...markdownDocument,
  format: "html",
} as const;

const missingDocument = {
  ...markdownDocument,
  contents: null,
  missing: true,
} as const;

type HookResult = Readonly<{
  current: DocumentReadiness;
  rerender: (state: SpecDocumentStateType) => void;
  unmount: () => void;
}>;

function renderDocumentReadiness(
  initialState: SpecDocumentStateType,
): HookResult {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as unknown as DocumentReadiness };
  let state = initialState;

  function TestComponent(): null {
    result.current = useDocumentReadiness(state);
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (nextState) => {
      state = nextState;
      act(() => {
        root.render(<TestComponent />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

test("createDocumentReadableKeyはready documentのidentityを作る", () => {
  const state = SpecDocumentState.loaded(
    "/workspace/spec-reviewer",
    "phase-1",
    "tasks",
    markdownDocument,
    "corr-1",
  );

  expect(createDocumentReadableKey(state)).toBe(
    ["/workspace/spec-reviewer", "phase-1", "tasks", "corr-1"].join("\u0000"),
  );
});

test("useDocumentReadinessはMarkdown初回readableまでcomment scopeを待つ", () => {
  const state = SpecDocumentState.loaded(
    "/workspace/spec-reviewer",
    "phase-1",
    "tasks",
    markdownDocument,
    "corr-1",
  );
  const result = renderDocumentReadiness(state);

  expect(result.current.isHtmlDocument).toBe(false);
  expect(result.current.isDocumentReadable).toBe(false);

  act(() => {
    result.current.markCurrentDocumentReadable();
  });

  expect(result.current.isDocumentReadable).toBe(true);
  result.unmount();
});

test.each([
  [
    SpecDocumentState.loaded(
      "/workspace/spec-reviewer",
      "phase-1",
      "tasks",
      htmlDocument,
    ),
    true,
    false,
  ],
  [
    SpecDocumentState.loaded(
      "/workspace/spec-reviewer",
      "phase-1",
      "tasks",
      missingDocument,
    ),
    false,
    true,
  ],
  [
    SpecDocumentState.failed("/workspace/spec-reviewer", "phase-1", "tasks", {
      feature: "specs",
      code: "unknown",
      message: "failed",
      cause: {
        command: "read_spec_file",
        code: "unknown",
        message: "failed",
        raw: "failed",
      },
    }),
    false,
    false,
  ],
] as const)("useDocumentReadinessはdocument状態ごとのreadabilityを返す", (state, expectedHtml, expectedReadable) => {
  const result = renderDocumentReadiness(state);

  expect(result.current.isHtmlDocument).toBe(expectedHtml);
  expect(result.current.isDocumentReadable).toBe(expectedReadable);
  result.unmount();
});
