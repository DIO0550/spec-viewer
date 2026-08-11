import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  memo,
  type ReactElement,
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { FileDiff, OmissionReason } from "@/features/diff/domain/fileDiff";
import {
  calculateVisibleWindow,
  findAdjacentChangeIndex,
} from "@/features/diff/lib/diffViewModel";
import {
  buildEditorViewModel,
  type EditorRow,
  materializeEditorRows,
} from "@/features/diff/lib/editorViewModel";
import {
  calculateMixedHeightOffsets,
  createMeasurementCache,
  getSemanticTargetOffset,
  type HeightMeasurementCache,
  mergeMeasuredHeights,
} from "@/features/diff/lib/editorWindowing";

export type CurrentFileViewerProps = Readonly<{
  fileDiff: FileDiff;
  revisionKey?: string;
  activeChangeId?: string | null;
  onActiveChangeIdChange?: (changeId: string | null) => void;
}>;

type ScrollAnchor = Readonly<{
  targetId: string;
  revisionKey: string;
  previousTargetOffset: number;
  viewportOffset: number;
  shouldContinueThroughMeasurement: boolean;
}>;

const CurrentContentMessages = {
  binary: "バイナリファイルは表示できません。",
  largeFile: "ファイルが大きすぎるため表示できません。",
  diffLimit: "表示上限を超えています。",
  missingSide: "current側の内容がありません。",
  unsupportedEntryKind: "このファイル種類は表示できません。",
} satisfies Record<OmissionReason, string>;

const OverscanRows = 100;
const SemanticRowHardCap = 500;

/**
 * Displays the current snapshot with validated gutters and non-commentable base peeks.
 *
 * @param props - Diff input, revision-local reset key, and controlled cross-view change ID.
 * @returns Accessible bounded editor rows or a safe availability state.
 */
export function CurrentFileViewer(props: CurrentFileViewerProps): ReactElement {
  const {
    fileDiff,
    revisionKey = `${fileDiff.identity.sourceId}:${fileDiff.identity.path}`,
    activeChangeId = null,
    onActiveChangeIdChange = () => undefined,
  } = props;
  const model = useMemo(
    () => buildEditorViewModel(fileDiff),
    [
      fileDiff.identity.path,
      fileDiff.identity.sourceId,
      fileDiff.review,
      fileDiff.availability,
    ],
  );
  const [expandedPeekIds, setExpandedPeekIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [measurements, setMeasurements] = useState<HeightMeasurementCache>(() =>
    createMeasurementCache(),
  );
  const [measurementRevisionKey, setMeasurementRevisionKey] =
    useState(revisionKey);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const pendingFrameRef = useRef<number | null>(null);
  const pendingMeasurementFrameRef = useRef<number | null>(null);
  const pendingMeasurementsRef = useRef<Record<string, number>>({});
  const previousRevisionKeyRef = useRef(revisionKey);
  const suppressedTargetRef = useRef<{
    revisionKey: string;
    changeId: string | null;
  } | null>(null);
  const measurementsRef = useRef(measurements);
  const measurementAnchorRef = useRef<ScrollAnchor | null>(null);
  const viewportAnchorRef = useRef<ScrollAnchor | null>(null);
  const programmaticScrollTopRef = useRef<number | null>(null);
  const revisionKeyRef = useRef(revisionKey);
  measurementsRef.current = measurements;
  revisionKeyRef.current = revisionKey;
  const expandedPeekIdsRef = useRef(expandedPeekIds);
  const changeTargetIdsRef = useRef(model.changeTargetIds);
  const rows = useMemo(
    () => materializeEditorRows(model, expandedPeekIds),
    [expandedPeekIds, model],
  );
  expandedPeekIdsRef.current = expandedPeekIds;
  changeTargetIdsRef.current = model.changeTargetIds;
  const offsets = useMemo(
    () => calculateMixedHeightOffsets(rows, measurements),
    [measurements, rows],
  );
  const rowsRef = useRef(rows);
  const offsetsRef = useRef(offsets);
  rowsRef.current = rows;
  offsetsRef.current = offsets;
  const resolvedActiveChangeIdRef = useRef<string | null>(null);

  const resolvedActiveChangeId =
    activeChangeId !== null && model.orderedChangeIds.includes(activeChangeId)
      ? activeChangeId
      : (model.orderedChangeIds[0] ?? null);
  resolvedActiveChangeIdRef.current = resolvedActiveChangeId;
  const visibleWindow = calculateVisibleWindow({
    offsets,
    scrollTop,
    viewportHeight,
    overscanRows: OverscanRows,
    hardCap: SemanticRowHardCap,
  });
  const visibleRows = rows.slice(
    visibleWindow.startIndex,
    visibleWindow.endIndex,
  );
  const visiblePeekControls = createVisiblePeekControls(visibleRows);
  const filePath =
    fileDiff.review.file.newPath ??
    fileDiff.review.file.oldPath ??
    fileDiff.identity.path;

  /** Synchronizes React windowing state with a programmatic DOM scroll. */
  const setProgrammaticScrollTop = useCallback(
    (nextScrollTop: number): void => {
      programmaticScrollTopRef.current = nextScrollTop;
      setScrollTop(nextScrollTop);
      if (scrollSurfaceRef.current !== null) {
        scrollSurfaceRef.current.scrollTop = nextScrollTop;
      }
    },
    [],
  );

  useEffect(() => {
    if (resolvedActiveChangeId !== activeChangeId) {
      onActiveChangeIdChange(resolvedActiveChangeId);
    }
  }, [activeChangeId, onActiveChangeIdChange, resolvedActiveChangeId]);

  useEffect(() => {
    if (previousRevisionKeyRef.current === revisionKey) {
      return;
    }
    suppressedTargetRef.current = {
      revisionKey,
      changeId: resolvedActiveChangeId,
    };
    previousRevisionKeyRef.current = revisionKey;
    setExpandedPeekIds(new Set());
    pendingMeasurementsRef.current = {};
    if (pendingMeasurementFrameRef.current !== null) {
      cancelAnimationFrame(pendingMeasurementFrameRef.current);
      pendingMeasurementFrameRef.current = null;
    }
    const emptyMeasurements = createMeasurementCache();
    measurementsRef.current = emptyMeasurements;
    measurementAnchorRef.current = null;
    viewportAnchorRef.current = null;
    setMeasurements(emptyMeasurements);
    setMeasurementRevisionKey(revisionKey);
    setProgrammaticScrollTop(0);
    setViewportHeight(0);
    setPendingFocusId(null);
  }, [revisionKey, setProgrammaticScrollTop]);

  useEffect(() => {
    const suppressedTarget = suppressedTargetRef.current;
    if (
      suppressedTarget?.revisionKey === revisionKey &&
      suppressedTarget.changeId === resolvedActiveChangeId
    ) {
      return;
    }
    if (suppressedTarget?.revisionKey === revisionKey) {
      suppressedTargetRef.current = null;
    }
    if (resolvedActiveChangeId === null) {
      return;
    }
    const targetId = model.changeTargetIds[resolvedActiveChangeId];
    if (targetId === undefined) {
      return;
    }
    const targetOffset = getSemanticTargetOffset(
      rowsRef.current,
      offsetsRef.current,
      targetId,
    );
    if (targetOffset === null) {
      return;
    }
    measurementAnchorRef.current = {
      targetId,
      revisionKey,
      previousTargetOffset: targetOffset,
      viewportOffset: 0,
      shouldContinueThroughMeasurement: false,
    };
    setProgrammaticScrollTop(targetOffset);
    setPendingFocusId(targetId);
  }, [
    model.changeTargetIds,
    resolvedActiveChangeId,
    revisionKey,
    setProgrammaticScrollTop,
  ]);

  useEffect(() => {
    if (pendingFocusId === null) {
      return;
    }
    const target = document.getElementById(createDomRowId(pendingFocusId));
    if (target === null) {
      return;
    }
    target.focus({ preventScroll: true });
    setPendingFocusId(null);
  }, [pendingFocusId, visibleRows]);

  /** Toggles local expansion without changing semantic identities. */
  const togglePeek = useCallback((peekId: string): void => {
    const currentRows = rowsRef.current;
    const activeChange = resolvedActiveChangeIdRef.current;
    const targetId =
      activeChange === null
        ? undefined
        : changeTargetIdsRef.current[activeChange];
    const peekIndex = currentRows.findIndex(
      (row) => row.kind === "peekSummary" && row.peek.id === peekId,
    );
    const targetIndex =
      targetId === undefined
        ? -1
        : currentRows.findIndex((row) => row.id === targetId);
    const peekRow = currentRows[peekIndex];
    const isPeekBeforeTarget =
      peekRow?.kind === "peekSummary" && peekIndex < targetIndex;

    if (targetId !== undefined && isPeekBeforeTarget) {
      const targetOffset = getSemanticTargetOffset(
        currentRows,
        offsetsRef.current,
        targetId,
      );
      const surface = scrollSurfaceRef.current;
      if (targetOffset !== null && surface !== null) {
        viewportAnchorRef.current = {
          targetId,
          revisionKey: revisionKeyRef.current,
          previousTargetOffset: targetOffset,
          viewportOffset: targetOffset - surface.scrollTop,
          shouldContinueThroughMeasurement:
            !expandedPeekIdsRef.current.has(peekId),
        };
      }
    }

    setExpandedPeekIds((current) => {
      const next = new Set(current);
      if (next.has(peekId)) {
        next.delete(peekId);
      } else {
        next.add(peekId);
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const anchor = viewportAnchorRef.current;
    if (anchor === null || anchor.revisionKey !== revisionKey) {
      return;
    }
    const targetOffset = getSemanticTargetOffset(
      rows,
      offsets,
      anchor.targetId,
    );
    if (targetOffset === null) {
      viewportAnchorRef.current = null;
      return;
    }
    const nextScrollTop = targetOffset - anchor.viewportOffset;
    if (targetOffset !== anchor.previousTargetOffset) {
      setProgrammaticScrollTop(nextScrollTop);
    }
    viewportAnchorRef.current = null;
    if (anchor.shouldContinueThroughMeasurement) {
      measurementAnchorRef.current = {
        ...anchor,
        previousTargetOffset: targetOffset,
        shouldContinueThroughMeasurement: false,
      };
    }
  }, [offsets, revisionKey, rows, setProgrammaticScrollTop]);

  /** Batches browser scroll events to one render per animation frame. */
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    const element = event.currentTarget;
    if (programmaticScrollTopRef.current === element.scrollTop) {
      programmaticScrollTopRef.current = null;
    } else {
      measurementAnchorRef.current = null;
      viewportAnchorRef.current = null;
    }

    if (pendingFrameRef.current !== null) {
      cancelAnimationFrame(pendingFrameRef.current);
    }
    pendingFrameRef.current = requestAnimationFrame(() => {
      setScrollTop(element.scrollTop);
      setViewportHeight(element.clientHeight);
      pendingFrameRef.current = null;
    });
  }, []);

  /** Batches visible-row measurements into one state update per frame. */
  const measureRow = useCallback(
    (rowId: string, element: HTMLDivElement | null): void => {
      if (element === null) {
        return;
      }
      pendingMeasurementsRef.current[rowId] =
        element.getBoundingClientRect().height;
      if (pendingMeasurementFrameRef.current !== null) {
        return;
      }
      pendingMeasurementFrameRef.current = requestAnimationFrame(() => {
        const collected = pendingMeasurementsRef.current;
        const currentMeasurements = measurementsRef.current;
        const nextMeasurements = mergeMeasuredHeights(
          currentMeasurements,
          collected,
        );
        pendingMeasurementsRef.current = {};
        pendingMeasurementFrameRef.current = null;

        const anchor = measurementAnchorRef.current;
        if (nextMeasurements !== currentMeasurements && anchor !== null) {
          const currentRows = rowsRef.current;
          const previousOffsets = calculateMixedHeightOffsets(
            currentRows,
            currentMeasurements,
          );
          const nextOffsets = calculateMixedHeightOffsets(
            currentRows,
            nextMeasurements,
          );
          const previousTargetOffset = getSemanticTargetOffset(
            currentRows,
            previousOffsets,
            anchor.targetId,
          );
          const nextTargetOffset = getSemanticTargetOffset(
            currentRows,
            nextOffsets,
            anchor.targetId,
          );
          const surface = scrollSurfaceRef.current;
          const canAdjust =
            anchor.revisionKey === revisionKeyRef.current &&
            previousTargetOffset !== null &&
            nextTargetOffset !== null &&
            surface !== null;
          if (canAdjust) {
            setProgrammaticScrollTop(
              surface.scrollTop + nextTargetOffset - previousTargetOffset,
            );
          }
        }
        if (anchor !== null && collected[anchor.targetId] !== undefined) {
          measurementAnchorRef.current = null;
        }
        if (nextMeasurements !== currentMeasurements) {
          measurementsRef.current = nextMeasurements;
          setMeasurements(nextMeasurements);
        }
      });
    },
    [setProgrammaticScrollTop],
  );

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
      if (pendingMeasurementFrameRef.current !== null) {
        cancelAnimationFrame(pendingMeasurementFrameRef.current);
      }
    };
  }, []);

  if (model.state === "currentUnavailable") {
    const reason = model.omissionReason ?? "missingSide";
    return (
      <ViewerState
        filePath={filePath}
        message={CurrentContentMessages[reason]}
      />
    );
  }
  if (model.state === "emptyFile") {
    return <ViewerState filePath={filePath} message="空のファイルです。" />;
  }

  const activeIndex =
    resolvedActiveChangeId === null
      ? -1
      : model.orderedChangeIds.indexOf(resolvedActiveChangeId);
  const hasPrevious = activeIndex > 0;
  const hasNext =
    activeIndex >= 0 && activeIndex < model.orderedChangeIds.length - 1;

  /** Moves the controlled cross-view selection without wrapping. */
  const navigate = (direction: "previous" | "next"): void => {
    const nextIndex = findAdjacentChangeIndex(
      model.orderedChangeIds,
      resolvedActiveChangeId,
      direction,
    );
    if (nextIndex === null) {
      return;
    }
    onActiveChangeIdChange(model.orderedChangeIds[nextIndex] ?? null);
  };

  return (
    <section
      className="current-file-viewer current-file-viewer--editor"
      aria-label={`${filePath} のcurrent内容`}
    >
      {model.state === "degraded" ? (
        <p className="current-file-viewer__warning" role="status">
          変更表示を利用できません。current全文を表示しています。
        </p>
      ) : null}
      {model.state === "inconsistent" ? (
        <p className="current-file-viewer__warning" role="alert">
          変更情報に不整合があります。安全なcurrent全文を表示しています。
        </p>
      ) : null}
      {model.orderedChangeIds.length > 0 ? (
        <ChangeNavigation
          activeIndex={activeIndex}
          changeCount={model.orderedChangeIds.length}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          onNavigate={navigate}
        />
      ) : null}
      <div
        ref={scrollSurfaceRef}
        className="current-file-viewer__scroll-surface"
        role="grid"
        aria-label={`${filePath} のcurrent行`}
        aria-rowcount={rows.length}
        tabIndex={0}
        onScroll={handleScroll}
      >
        <div
          className="current-file-viewer__spacer"
          style={{ height: visibleWindow.topSpacerHeight }}
          aria-hidden="true"
        />
        {visibleRows.map((row, visibleIndex) => (
          <EditorRowView
            key={`${measurementRevisionKey}:${row.id}`}
            row={row}
            rowIndex={visibleWindow.startIndex + visibleIndex + 1}
            expandedPeekIds={expandedPeekIds}
            activeChangeId={resolvedActiveChangeId}
            controlledRowIds={
              visiblePeekControls[row.kind === "peekSummary" ? row.peek.id : ""]
            }
            onTogglePeek={togglePeek}
            onMeasure={measureRow}
          />
        ))}
        <div
          className="current-file-viewer__spacer"
          style={{ height: visibleWindow.bottomSpacerHeight }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

/** Renders reason-specific current availability inside a path-labelled section. */
function ViewerState(
  props: Readonly<{ filePath: string; message: string }>,
): ReactElement {
  return (
    <section
      className="current-file-viewer current-file-viewer--editor"
      aria-label={`${props.filePath} のcurrent内容`}
    >
      <p className="current-file-viewer__state" role="status">
        {props.message}
      </p>
    </section>
  );
}

/** Renders previous/next controls for the controlled logical change ID. */
function ChangeNavigation(
  props: Readonly<{
    activeIndex: number;
    changeCount: number;
    hasPrevious: boolean;
    hasNext: boolean;
    onNavigate: (direction: "previous" | "next") => void;
  }>,
): ReactElement {
  return (
    <div
      className="current-file-viewer__navigation"
      role="group"
      aria-label="変更箇所ナビゲーション"
    >
      <button
        type="button"
        aria-label="前の変更"
        disabled={!props.hasPrevious}
        onClick={() => props.onNavigate("previous")}
      >
        <ChevronLeft aria-hidden="true" size={14} />
      </button>
      <span aria-live="polite">
        {props.activeIndex < 0 ? 0 : props.activeIndex + 1} /{" "}
        {props.changeCount}
      </span>
      <button
        type="button"
        aria-label="次の変更"
        disabled={!props.hasNext}
        onClick={() => props.onNavigate("next")}
      >
        <ChevronRight aria-hidden="true" size={14} />
      </button>
    </div>
  );
}

/** Renders one semantic editor row with explicit commentability. */
const EditorRowView = memo(function EditorRowView(
  props: Readonly<{
    row: EditorRow;
    rowIndex: number;
    expandedPeekIds: ReadonlySet<string>;
    activeChangeId: string | null;
    onTogglePeek: (peekId: string) => void;
    controlledRowIds?: string;
    onMeasure: (rowId: string, element: HTMLDivElement | null) => void;
  }>,
): ReactElement {
  const { row } = props;
  const measureRef = useCallback(
    (element: HTMLDivElement | null): void => {
      props.onMeasure(row.id, element);
    },
    [props.onMeasure, row.id],
  );
  const commonProps = {
    id: createDomRowId(row.id),
    role: "row",
    "aria-rowindex": props.rowIndex,
    "data-commentable": row.commentability === "current" ? "true" : "false",
    ref: measureRef,
    tabIndex: -1,
  } as const;

  if (row.kind === "currentLine") {
    const isActive =
      row.changeId !== null && row.changeId === props.activeChangeId;
    return (
      <div
        {...commonProps}
        className="current-file-viewer__row"
        data-row-kind="current-line"
        data-change-kind={row.gutterKind}
        data-active-change={isActive ? "true" : "false"}
      >
        <span
          role="gridcell"
          className="current-file-viewer__gutter"
          aria-label={getGutterLabel(row.gutterKind)}
        />
        <span
          role="gridcell"
          className="current-file-viewer__line-number"
          aria-label={`${row.lineNumber}行目`}
        >
          <span aria-hidden="true">{row.lineNumber}</span>
        </span>
        <code role="gridcell" className="current-file-viewer__code">
          {row.text || " "}
        </code>
      </div>
    );
  }

  if (row.kind === "peekSummary") {
    const isActive = row.peek.changeId === props.activeChangeId;
    const expanded = props.expandedPeekIds.has(row.peek.id);
    const label =
      row.peek.kind === "previous"
        ? `変更前 ${row.peek.oldLines.length}行`
        : `${row.peek.oldLines.length}行削除`;
    return (
      <div
        {...commonProps}
        className="current-file-viewer__row current-file-viewer__peek-summary"
        data-row-kind="peek-summary"
        data-active-change={isActive ? "true" : "false"}
      >
        <span role="gridcell">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? props.controlledRowIds : undefined}
            onClick={() => props.onTogglePeek(row.peek.id)}
          >
            {label}
          </button>
        </span>
      </div>
    );
  }

  if (row.kind === "peekLine") {
    const label = row.peekKind === "previous" ? "変更前" : "削除済み";
    return (
      <div
        {...commonProps}
        data-peek-id={row.peekId}
        className="current-file-viewer__row current-file-viewer__peek-line"
        data-row-kind="peek-line"
      >
        <span
          role="gridcell"
          className="current-file-viewer__line-number"
          aria-label={`${label} ${row.oldLineNumber}行目`}
        >
          <span aria-hidden="true">{row.oldLineNumber}</span>
        </span>
        <code role="gridcell" className="current-file-viewer__code">
          <span className="current-file-viewer__peek-prefix">
            {label} {row.oldLineNumber}{" "}
          </span>
          {row.text || " "}
        </code>
      </div>
    );
  }

  return (
    <div
      {...commonProps}
      data-peek-id={row.peekId}
      className="current-file-viewer__row current-file-viewer__annotation"
      data-row-kind="annotation"
      aria-label={`base note: ${row.text}`}
    >
      <span role="gridcell">{row.text}</span>
    </div>
  );
});

/**
 * Groups IDs of actual rendered peek rows for an ARIA controls relationship.
 *
 * @param rows - Windowed rows currently present in the DOM.
 * @returns Space-separated DOM row IDs keyed by their peek identity.
 */
function createVisiblePeekControls(
  rows: readonly EditorRow[],
): Readonly<Record<string, string>> {
  const controls: Record<string, string> = {};
  for (const row of rows) {
    if (row.kind !== "peekLine" && row.kind !== "annotation") {
      continue;
    }
    const rowId = createDomRowId(row.id);
    const previousIds = controls[row.peekId];
    controls[row.peekId] =
      previousIds === undefined ? rowId : `${previousIds} ${rowId}`;
  }
  return controls;
}
/** Returns a non-color-only label for a current gutter kind. */
function getGutterLabel(kind: "unchanged" | "added" | "modified"): string {
  if (kind === "added") {
    return "追加";
  }
  if (kind === "modified") {
    return "変更";
  }
  return "変更なし";
}

/** Converts a semantic projection ID to a document-safe row ID. */
function createDomRowId(rowId: string): string {
  return `current-file-viewer-row-${rowId}`;
}
