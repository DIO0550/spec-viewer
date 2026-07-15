import { act, type ReactElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";
import {
  createViewerResetKey,
  useViewerReset,
} from "@/features/specs/hooks/useViewerReset";
import * as TestValues from "@/shared/testing/validatedValueObjects";

type ViewerResetHarnessProps = Readonly<{
  resetKey: string;
  shouldFocus: boolean;
  scrollTo: HTMLElement["scrollTo"];
  focus: HTMLElement["focus"];
}>;

type RenderedViewerResetHarness = Readonly<{
  render: (props: ViewerResetHarnessProps) => void;
  unmount: () => void;
}>;

function ViewerResetHarness({
  resetKey,
  shouldFocus,
  scrollTo,
  focus,
}: ViewerResetHarnessProps): ReactElement {
  const panelRef = useRef<HTMLElement | null>(null);

  useViewerReset(panelRef, resetKey, shouldFocus);

  return (
    <section
      ref={(element) => {
        Object.assign(element ?? {}, { scrollTo });
      }}
    >
      <article
        ref={(element) => {
          panelRef.current = element;
          Object.assign(element ?? {}, { focus });
        }}
        tabIndex={-1}
      />
    </section>
  );
}

function renderViewerResetHarness(
  props: ViewerResetHarnessProps,
): RenderedViewerResetHarness {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = (nextProps: ViewerResetHarnessProps): void => {
    act(() => {
      root.render(<ViewerResetHarness {...nextProps} />);
    });
  };

  render(props);

  return {
    render,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

test("useViewerResetは初回表示ではスクロールとフォーカスを変更しない", () => {
  const scrollTo = vi.fn();
  const focus = vi.fn();

  const result = renderViewerResetHarness({
    resetKey: "initial",
    shouldFocus: true,
    scrollTo,
    focus,
  });

  expect(scrollTo).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
  result.unmount();
});

test("useViewerResetはresetKey変更時に親スクロールを戻してviewerへフォーカスする", () => {
  const scrollTo = vi.fn();
  const focus = vi.fn();
  const result = renderViewerResetHarness({
    resetKey: "initial",
    shouldFocus: true,
    scrollTo,
    focus,
  });

  result.render({
    resetKey: "next",
    shouldFocus: true,
    scrollTo,
    focus,
  });

  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  result.unmount();
});

test("useViewerResetはフォーカス不要のresetKey変更時にスクロールだけ戻す", () => {
  const scrollTo = vi.fn();
  const focus = vi.fn();
  const result = renderViewerResetHarness({
    resetKey: "initial",
    shouldFocus: false,
    scrollTo,
    focus,
  });

  result.render({
    resetKey: "next",
    shouldFocus: false,
    scrollTo,
    focus,
  });

  expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  expect(focus).not.toHaveBeenCalled();
  result.unmount();
});

test("createViewerResetKeyはselection identityとload revisionからstable keyを作る", () => {
  const state: SpecDocumentState = {
    status: "ready",
    workspacePath: "/workspace/project",
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
    loadRevision: "load-reset",
    document: {
      kind: "markdown",
      key: "tasks",
      path: "/workspace/project/.plugin-workspace/.specs/auth/tasks.md",
      contents: "# Task",
      blocks: [],
    },
    error: null,
  };

  expect(createViewerResetKey(state)).toBe(
    JSON.stringify([
      "ready",
      "/workspace/project",
      "auth",
      "tasks",
      "load-reset",
    ]),
  );
});

test("createViewerResetKeyは区切り文字を含む別identityを同じkeyにしない", () => {
  const firstState: SpecDocumentState = {
    status: "ready",
    workspacePath: "/workspace:auth",
    specId: TestValues.specId("tasks"),
    fileKey: "requirements",
    loadRevision: "revision",
    document: {
      kind: "markdown",
      key: "requirements",
      path: "/workspace:auth/tasks/requirements.md",
      contents: "# Requirements",
      blocks: [],
    },
    error: null,
  };
  const secondState: SpecDocumentState = {
    status: "ready",
    workspacePath: "/workspace",
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
    loadRevision: "requirements:revision",
    document: {
      kind: "markdown",
      key: "tasks",
      path: "/workspace/auth/tasks.md",
      contents: "# Tasks",
      blocks: [],
    },
    error: null,
  };

  expect(createViewerResetKey(firstState)).not.toBe(
    createViewerResetKey(secondState),
  );
});
