export type PerformancePhase =
  | "workspace.open"
  | "specs.list"
  | "document.read"
  | "document.render"
  | "document.firstReadable"
  | "comments.list"
  | "userReviews.list"
  | "watcher.invalidate";

export type PerformanceMetadata = Record<
  string,
  string | number | boolean | null
>;

export type PerformanceSpan = Readonly<{
  correlationId: string;
  phase: PerformancePhase;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  metadata?: PerformanceMetadata;
}>;

let loggerEnabledOverride: boolean | null = null;

/** Sets a deterministic logger state for tests. */
export function configurePerformanceLoggerForTest(
  enabled: boolean | null,
): void {
  loggerEnabledOverride = enabled;
}

/** @returns A readable correlation id for a related group of performance events. */
export function createPerformanceCorrelationId(prefix: string): string {
  const normalizedPrefix = prefix.trim().replace(/\s+/g, "-") || "perf";
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);

  return `${normalizedPrefix}-${timestamp}-${random}`;
}

/** @returns Provided correlation id, or a generated one when absent. */
export function resolvePerformanceCorrelationId(
  correlationId: string | null | undefined,
  prefix: string,
): string {
  if (correlationId === null || correlationId === undefined) {
    return createPerformanceCorrelationId(prefix);
  }

  return correlationId;
}

/** @returns A callback that ends and records one performance span. */
export function startPerformanceSpan(
  correlationId: string,
  phase: PerformancePhase,
  metadata?: PerformanceMetadata,
): (metadata?: PerformanceMetadata) => PerformanceSpan {
  const startedAt = now();
  const startMark = markName(correlationId, phase, "start");

  mark(startMark);

  return (endMetadata?: PerformanceMetadata): PerformanceSpan => {
    const endedAt = now();
    const endMark = markName(correlationId, phase, "end");
    const span = {
      correlationId,
      phase,
      startedAt,
      endedAt,
      durationMs: Math.max(0, endedAt - startedAt),
      metadata: mergeMetadata(metadata, endMetadata),
    };

    mark(endMark);
    measure(correlationId, phase, startMark, endMark);
    emit("span", span);

    return span;
  };
}

/** Records a point-in-time performance event. */
export function recordPerformancePoint(
  correlationId: string,
  phase: PerformancePhase,
  metadata?: PerformanceMetadata,
): void {
  if (!isPerformanceLoggerEnabled()) {
    return;
  }

  const pointMetadata = metadata === undefined ? {} : metadata;
  mark(markName(correlationId, phase, "point"));
  console.debug("[spec-viewer:perf]", {
    type: "point",
    correlationId,
    phase,
    metadata: pointMetadata,
  });
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function isPerformanceLoggerEnabled(): boolean {
  if (loggerEnabledOverride !== null) {
    return loggerEnabledOverride;
  }

  return import.meta.env.DEV;
}

function markName(
  correlationId: string,
  phase: PerformancePhase,
  point: "start" | "end" | "point",
): string {
  return `spec-viewer:${correlationId}:${phase}:${point}`;
}

function mark(name: string): void {
  if (!isPerformanceLoggerEnabled()) {
    return;
  }

  globalThis.performance?.mark?.(name);
}

function measure(
  correlationId: string,
  phase: PerformancePhase,
  startMark: string,
  endMark: string,
): void {
  if (!isPerformanceLoggerEnabled()) {
    return;
  }

  globalThis.performance?.measure?.(
    `spec-viewer:${correlationId}:${phase}`,
    startMark,
    endMark,
  );
}

function emit(type: "span", span: PerformanceSpan): void {
  if (!isPerformanceLoggerEnabled()) {
    return;
  }

  console.debug("[spec-viewer:perf]", {
    type,
    ...span,
  });
}

function mergeMetadata(
  initialMetadata: PerformanceMetadata | undefined,
  endMetadata: PerformanceMetadata | undefined,
): PerformanceMetadata | undefined {
  if (initialMetadata === undefined && endMetadata === undefined) {
    return undefined;
  }

  return {
    ...initialMetadata,
    ...endMetadata,
  };
}
