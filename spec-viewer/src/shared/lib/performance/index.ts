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

/**
 * @param prefix - Label prepended to the generated correlation id.
 * @returns A readable correlation id for a related group of performance events.
 */
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

/** @returns The current high-resolution timestamp in milliseconds. */
function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

/** @returns Whether performance logging is currently enabled. */
function isPerformanceLoggerEnabled(): boolean {
  if (loggerEnabledOverride !== null) {
    return loggerEnabledOverride;
  }

  return import.meta.env.DEV;
}

/**
 * @param correlationId - Identifier grouping related performance events.
 * @param phase - Phase the mark belongs to.
 * @param point - Whether the mark is the span start, end, or a single point.
 * @returns A namespaced performance mark name.
 */
function markName(
  correlationId: string,
  phase: PerformancePhase,
  point: "start" | "end" | "point",
): string {
  return `spec-viewer:${correlationId}:${phase}:${point}`;
}

/** @param name - Performance mark name to record when logging is enabled. */
function mark(name: string): void {
  if (!isPerformanceLoggerEnabled()) {
    return;
  }

  globalThis.performance?.mark?.(name);
}

/**
 * @param correlationId - Identifier grouping related performance events.
 * @param phase - Phase the measurement belongs to.
 * @param startMark - Name of the start mark.
 * @param endMark - Name of the end mark.
 */
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

/**
 * @param type - Event category being emitted.
 * @param span - The completed performance span to log.
 */
function emit(type: "span", span: PerformanceSpan): void {
  if (!isPerformanceLoggerEnabled()) {
    return;
  }

  console.debug("[spec-viewer:perf]", {
    type,
    ...span,
  });
}

/**
 * @param initialMetadata - Metadata captured when the span started.
 * @param endMetadata - Metadata captured when the span ended.
 * @returns The merged metadata, or undefined when both are absent.
 */
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
