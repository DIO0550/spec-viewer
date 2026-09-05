import { act, Profiler, type ProfilerOnRenderCallback } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { DiffReviewSidebar } from "@/features/diffComments/components/DiffReviewSidebar";

const comments = Array.from({ length: 10_000 }, (_, index) => ({
  id: `comment-${index}`,
  body: `Review body ${index}`,
  status: index % 2 === 0 ? ("open" as const) : ("resolved" as const),
  locationLabel: `src/file.ts current ${index + 1}行目`,
  snippet: `line ${index + 1}`,
  resolution: { status: "exact" as const },
}));

const MeasuredUpdateCount = 7;

/** Stable callback used to isolate warning-only render work. */
const doNothing = (): void => undefined;

test("10k Review projectionは無関係なwarning更新で再計算workを抑える", () => {
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
  const root = createRoot(container);

  const render = (warnings: readonly string[]): void => {
    root.render(
      <Profiler id="review-10k" onRender={onRender}>
        <DiffReviewSidebar
          comments={comments}
          filter="all"
          search=""
          selectedCommentId="comment-9999"
          loadState="ready"
          warnings={warnings}
          onFilterChange={doNothing}
          onSearchChange={doNothing}
          onSelectComment={doNothing}
          onJump={doNothing}
          onResolve={doNothing}
          onReopen={doNothing}
        />
      </Profiler>,
    );
  };

  act(() => render([]));
  act(() => render(["warmup"]));
  samples.length = 0;
  for (let index = 0; index < MeasuredUpdateCount; index += 1) {
    act(() => render([`durability uncertain ${index}`]));
  }

  const workRatios = samples
    .map(({ actual, base }) => actual / base)
    .sort((left, right) => left - right);
  const medianWorkRatio = workRatios[Math.floor(workRatios.length / 2)];
  expect(samples).toHaveLength(MeasuredUpdateCount);
  expect(samples.every(({ base }) => base > 0)).toBe(true);
  expect(medianWorkRatio).toBeLessThan(0.5);
  expect(container.querySelectorAll("article[data-comment-id]")).toHaveLength(
    100,
  );

  act(() => root.unmount());
  container.remove();
});

test("10k Review searchとfilterは結果を正しく再projectionする", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DiffReviewSidebar
        comments={comments}
        filter="resolved"
        search="Review body 9999"
        selectedCommentId={null}
        loadState="ready"
        warnings={[]}
        onFilterChange={() => undefined}
        onSearchChange={() => undefined}
        onSelectComment={() => undefined}
        onJump={() => undefined}
        onResolve={() => undefined}
        onReopen={() => undefined}
      />,
    );
  });
  expect(container.querySelectorAll("article[data-comment-id]")).toHaveLength(
    1,
  );
  expect(container.textContent).toContain("Review body 9999");
  act(() => root.unmount());
  container.remove();
});
