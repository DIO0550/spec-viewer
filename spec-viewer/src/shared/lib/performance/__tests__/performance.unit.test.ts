import { afterEach, expect, test, vi } from "vitest";

import {
  configurePerformanceLoggerForTest,
  createPerformanceCorrelationId,
  recordPerformancePoint,
  resolvePerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

afterEach(() => {
  configurePerformanceLoggerForTest(null);
  vi.restoreAllMocks();
});

test("performance loggerはprefix付きcorrelation idを生成する", () => {
  const correlationId = createPerformanceCorrelationId("document read");

  expect(correlationId).toMatch(/^document-read-[a-z0-9]+-[a-z0-9]+$/);
});

test.each([
  null,
  undefined,
] as const)("performance loggerはcorrelation idが%sならprefix付きIDを生成する", (correlationId) => {
  const resolvedCorrelationId = resolvePerformanceCorrelationId(
    correlationId,
    "comments list",
  );

  expect(resolvedCorrelationId).toMatch(/^comments-list-[a-z0-9]+-[a-z0-9]+$/);
});

test("performance loggerは既存correlation idをそのまま返す", () => {
  expect(resolvePerformanceCorrelationId("cid-1", "comments list")).toBe(
    "cid-1",
  );
});

test("performance loggerはspanのdurationとmetadataを記録する", () => {
  configurePerformanceLoggerForTest(true);
  const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
  let now = 100;
  vi.spyOn(performance, "now").mockImplementation(() => {
    const current = now;
    now += 42;
    return current;
  });

  const endSpan = startPerformanceSpan("cid-1", "document.read", {
    specId: "auth",
  });
  const span = endSpan({ bytes: 256 });

  expect(span).toMatchObject({
    correlationId: "cid-1",
    phase: "document.read",
    startedAt: 100,
    endedAt: 142,
    durationMs: 42,
    metadata: {
      specId: "auth",
      bytes: 256,
    },
  });
  expect(debug).toHaveBeenCalledWith(
    "[spec-viewer:perf]",
    expect.objectContaining({
      type: "span",
      correlationId: "cid-1",
      phase: "document.read",
    }),
  );
});

test("performance loggerは無効時にperformance APIとconsoleへ出力しない", () => {
  configurePerformanceLoggerForTest(false);
  const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
  const mark = vi.spyOn(performance, "mark");
  const measure = vi.spyOn(performance, "measure");

  const endSpan = startPerformanceSpan("cid-2", "comments.list");
  endSpan();
  recordPerformancePoint("cid-2", "document.firstReadable");

  expect(mark).not.toHaveBeenCalled();
  expect(measure).not.toHaveBeenCalled();
  expect(debug).not.toHaveBeenCalled();
});
