export type PerformancePhase =
  | "workspace.open"
  | "specs.list"
  | "document.read"
  | "document.render"
  | "document.firstReadable"
  | "comments.list"
  | "repository.overview"
  | "repository.file"
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
 * @param prefix - Label prefixed to the generated correlation id.
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
 * Builds a namespaced performance mark name.
 * @param correlationId - Correlation id grouping related events.
 * @param phase - Performance phase the mark belongs to.
 * @param point - Which point in the span this mark represents.
 * @returns The fully qualified mark name.
 */
function markName(
  correlationId: string,
  phase: PerformancePhase,
  point: "start" | "end" | "point",
): string {
  return `spec-viewer:${correlationId}:${phase}:${point}`;
}

/**
 * Records a performance mark when logging is enabled.
 * @param name - Mark name to record.
 */
function mark(name: string): void {
  if (!isPerformanceLoggerEnabled()) {
    return;
  }

  globalThis.performance?.mark?.(name);
}

/**
 * Records a performance measure between two marks when logging is enabled.
 * @param correlationId - Correlation id grouping related events.
 * @param phase - Performance phase being measured.
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
 * Emits a performance event to the debug console when logging is enabled.
 * @param type - Event type discriminator.
 * @param span - Completed performance span to emit.
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
 * Merges start and end metadata into a single record.
 * @param initialMetadata - Metadata provided when the span started.
 * @param endMetadata - Metadata provided when the span ended.
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
