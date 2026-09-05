import { act, Profiler, type ProfilerOnRenderCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DiffViewer } from "@/features/diff/components/DiffViewer";
import { createLargeDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import type { DiffLineCommentsController } from "@/features/diffComments/components/DiffLineCommentSlot";

const roots: Root[] = [];
const containers: HTMLDivElement[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => act(() => root.unmount()));
  containers.splice(0).forEach((container) => container.remove());
});

test("500 visible rowsでcomposer keystrokeのProfiler workをactive rowへ限定する", () => {
  const samples: Array<Readonly<{ actual: number; base: number }>> = [];
  const onRender: ProfilerOnRenderCallback = (
    _id,
    phase,
    actualDuration,
    baseDuration,
  ) => {
    if (phase === "update") {
      samples.push({ actual: actualDuration, base: baseDuration });
    }
  };
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(
      <Profiler id="diff-comment-keystroke" onRender={onRender}>
        <PerformanceHarness />
      </Profiler>,
    );
  });
  const surface = container.querySelector<HTMLElement>(
    ".diff-viewer__scroll-surface",
  );
  if (surface === null) {
    throw new Error("Expected diff scroll surface");
  }
  Object.defineProperty(surface, "clientHeight", {
    configurable: true,
    value: 20_000,
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(performance.now());
    return 1;
  });
  act(() => surface.dispatchEvent(new Event("scroll", { bubbles: true })));
  expect(container.querySelectorAll(".diff-viewer__row")).toHaveLength(500);

  const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
  if (textarea === null) {
    throw new Error("Expected active diff comment composer");
  }
  updateTextarea(textarea, "review-warmup");
  const workRatios = Array.from({ length: 5 }, (_, index) => {
    samples.length = 0;
    updateTextarea(textarea, `review-measured-${index}`);
    const keystroke = samples[samples.length - 1];
    expect(keystroke).toBeDefined();
    return (
      (keystroke?.actual ?? Number.POSITIVE_INFINITY) / (keystroke?.base ?? 0)
    );
  }).sort((left, right) => left - right);
  const medianWorkRatio = workRatios[Math.floor(workRatios.length / 2)];
  expect(medianWorkRatio).toBeLessThan(0.35);
  expect(container.querySelectorAll(".diff-viewer__row").length).toBe(500);
});

function updateTextarea(textarea: HTMLTextAreaElement, body: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, body);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function PerformanceHarness() {
  const [body, setBody] = useState("review");
  const target = {
    key: "current:implementation-plan.md:1",
    side: "current" as const,
    sidePath: "implementation-plan.md",
    line: 1,
  };
  const controller: DiffLineCommentsController = {
    commentsByTarget: {},
    activeCommentId: null,
    draft: { target, body, isSaving: false, origin: null },
    onStartDraft: () => undefined,
    onDraftBodyChange: setBody,
    onCancelDraft: () => undefined,
    onSubmitDraft: () => undefined,
    onSelectComment: () => undefined,
  };
  return (
    <DiffViewer
      fileDiff={createLargeDiffViewerFixture()}
      mode="unified"
      activeChangeId={null}
      onActiveChangeIdChange={() => undefined}
      lineComments={controller}
    />
  );
}
