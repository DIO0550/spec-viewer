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
  type EditorCurrentLine,
} from "@/features/diff/lib/editorViewModel";
import {
  calculateMixedHeightOffsets,
  createMeasurementCache,
  getSemanticTargetOffset,
  type HeightMeasurementCache,
  mergeMeasuredHeights,
} from "@/features/diff/lib/editorWindowing";
import {
  DiffInlineCommentThread,
  DiffLineCommentSlot,
  type DiffCommentJumpTarget,
  type DiffLineCommentsController,
} from "@/features/diffComments/components/DiffLineCommentSlot";
import { focusCommentTarget } from "@/features/diffComments/components/commentNavigation";

export type CurrentFileViewerProps = Readonly<{
  fileDiff: FileDiff;
  revisionKey?: string;
  activeChangeId?: string | null;
  onActiveChangeIdChange?: (changeId: string | null) => void;
  lineComments?: DiffLineCommentsController;
  commentJumpTarget?: DiffCommentJumpTarget | null;
}>;

type ScrollAnchor = Readonly<{
  targetId: string;
  revisionKey: string;
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
 * Displays only the current snapshot with validated change gutters.
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
    lineComments,
    commentJumpTarget,
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
  const programmaticScrollTopRef = useRef<number | null>(null);
  const revisionKeyRef = useRef(revisionKey);
  measurementsRef.current = measurements;
  revisionKeyRef.current = revisionKey;
  const rows = model.currentLines;
  const offsets = useMemo(
    () => calculateMixedHeightOffsets(rows, measurements),
    [measurements, rows],
  );
  const rowsRef = useRef(rows);
  const offsetsRef = useRef(offsets);
  rowsRef.current = rows;
  offsetsRef.current = offsets;

  const resolvedActiveChangeId =
    activeChangeId !== null && model.orderedChangeIds.includes(activeChangeId)
      ? activeChangeId
      : null;
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
  const filePath =
    fileDiff.review.file.newPath ??
    fileDiff.review.file.oldPath ??
    fileDiff.identity.path;
  const viewerClassName =
    lineComments === undefined
      ? "current-file-viewer current-file-viewer--editor"
      : "current-file-viewer current-file-viewer--editor current-file-viewer--with-comments";

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
    if (
      commentJumpTarget === null ||
      commentJumpTarget === undefined ||
      commentJumpTarget.side !== "current"
    ) {
      return;
    }
    const targetIndex = rows.findIndex(
      (row) =>
        row.kind === "currentLine" &&
        row.anchor.newPath === commentJumpTarget.sidePath &&
        row.lineNumber === commentJumpTarget.line,
    );
    if (targetIndex < 0) {
      return;
    }
    setProgrammaticScrollTop(offsets[targetIndex] ?? 0);
    const frameId = requestAnimationFrame(() => {
      focusCommentTarget(scrollSurfaceRef.current, commentJumpTarget.key);
    });
    return () => cancelAnimationFrame(frameId);
  }, [commentJumpTarget?.requestId, offsets, rows, setProgrammaticScrollTop]);
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
    pendingMeasurementsRef.current = {};
    if (pendingMeasurementFrameRef.current !== null) {
      cancelAnimationFrame(pendingMeasurementFrameRef.current);
      pendingMeasurementFrameRef.current = null;
    }
    const emptyMeasurements = createMeasurementCache();
    measurementsRef.current = emptyMeasurements;
    measurementAnchorRef.current = null;
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
    const targetId = findCurrentChangeTargetId(
      rowsRef.current,
      resolvedActiveChangeId,
    );
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
    };
    setProgrammaticScrollTop(targetOffset);
    setPendingFocusId(targetId);
  }, [resolvedActiveChangeId, revisionKey, setProgrammaticScrollTop]);

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

  /** Batches browser scroll events to one render per animation frame. */
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    const element = event.currentTarget;
    if (programmaticScrollTopRef.current === element.scrollTop) {
      programmaticScrollTopRef.current = null;
    } else {
      measurementAnchorRef.current = null;
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
        if (nextMeasurements !== currentMeasurements) {
          const currentRows = rowsRef.current;
          const previousOffsets = calculateMixedHeightOffsets(
            currentRows,
            currentMeasurements,
          );
          const nextOffsets = calculateMixedHeightOffsets(
            currentRows,
            nextMeasurements,
          );
          const surface = scrollSurfaceRef.current;
          if (surface !== null) {
            let anchorTargetId: string | null = null;
            if (
              anchor !== null &&
              anchor.revisionKey === revisionKeyRef.current
            ) {
              anchorTargetId = anchor.targetId;
            } else {
              anchorTargetId = findViewportAnchorRowId(
                currentRows,
                previousOffsets,
                surface.scrollTop,
              );
            }
            if (anchorTargetId !== null) {
              const previousTargetOffset = getSemanticTargetOffset(
                currentRows,
                previousOffsets,
                anchorTargetId,
              );
              const nextTargetOffset = getSemanticTargetOffset(
                currentRows,
                nextOffsets,
                anchorTargetId,
              );
              if (previousTargetOffset !== null && nextTargetOffset !== null) {
                setProgrammaticScrollTop(
                  surface.scrollTop + nextTargetOffset - previousTargetOffset,
                );
              }
            }
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
  if (fileDiff.review.file.change === "deleted") {
    return (
      <ViewerState
        filePath={filePath}
        message={CurrentContentMessages.missingSide}
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
      className={viewerClassName}
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
            activeChangeId={resolvedActiveChangeId}
            onMeasure={measureRow}
            lineComments={lineComments}
            oldPath={fileDiff.review.file.oldPath}
            newPath={fileDiff.review.file.newPath}
          />
        ))}
        <div
          className="current-file-viewer__spacer"
          style={{ height: visibleWindow.bottomSpacerHeight }}
          aria-hidden="true"
        />
        <div className="current-file-viewer__end-spacer" aria-hidden="true" />
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
    row: EditorCurrentLine;
    rowIndex: number;
    activeChangeId: string | null;
    onMeasure: (rowId: string, element: HTMLDivElement | null) => void;
    lineComments?: DiffLineCommentsController;
    oldPath: string | null;
    newPath: string | null;
  }>,
): ReactElement {
  const { row } = props;
  const rowElementRef = useRef<HTMLDivElement>(null);
  const commentTargetKey =
    "current:" + row.anchor.newPath + ":" + row.lineNumber;
  const commentTarget = {
    key: commentTargetKey,
    side: "current" as const,
    sidePath: row.anchor.newPath,
    oldPath: props.oldPath ?? undefined,
    newPath: props.newPath ?? row.anchor.newPath,
    line: row.lineNumber,
  };
  const activeRange = props.lineComments?.draft?.target;
  const isRangeSelected =
    activeRange !== undefined &&
    activeRange.endLine !== undefined &&
    activeRange.side === "current" &&
    activeRange.sidePath === commentTarget.sidePath &&
    commentTarget.line >= activeRange.line &&
    commentTarget.line <= activeRange.endLine;
  const activeDraft =
    props.lineComments?.draft?.target.key === commentTargetKey
      ? props.lineComments.draft
      : null;
  useLayoutEffect(() => {
    props.onMeasure(row.id, rowElementRef.current);
  }, [activeDraft, props.onMeasure, row.id]);
  const commonProps = {
    id: createDomRowId(row.id),
    role: "row",
    "aria-rowindex": props.rowIndex,
    "data-commentable": row.commentability === "current" ? "true" : "false",
    ref: rowElementRef,
    tabIndex: -1,
  } as const;

  const isActive =
    row.changeId !== null && row.changeId === props.activeChangeId;
  return (
    <div
      {...commonProps}
      className="current-file-viewer__row"
      data-row-kind="current-line"
      data-change-kind={row.gutterKind}
      data-active-change={isActive ? "true" : "false"}
      data-diff-comment-line-container="true"
      data-diff-comment-current-path={commentTarget.sidePath}
      data-diff-comment-current-line={commentTarget.line}
      data-diff-comment-range-selected={isRangeSelected ? "true" : undefined}
    >
      {props.lineComments === undefined ? null : (
        <DiffLineCommentSlot
          target={commentTarget}
          controller={props.lineComments}
        />
      )}
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
      {props.lineComments === undefined ? null : (
        <DiffInlineCommentThread
          target={commentTarget}
          controller={props.lineComments}
        />
      )}
    </div>
  );
});

/**
 * Finds the current line that represents a logical change.
 *
 * @param lines - Current-only Editor rows.
 * @param changeId - Logical change selected across viewers.
 * @returns The current row ID, or undefined for deletion-only changes.
 */
function findCurrentChangeTargetId(
  lines: readonly EditorCurrentLine[],
  changeId: string,
): string | undefined {
  return lines.find((line) => line.changeId === changeId)?.id;
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

/**
 * Resolves the row currently anchoring the top of the Editor viewport.
 *
 * @param rows - Ordered current-only Editor rows.
 * @param offsets - Prefix offsets calculated from the previous measurements.
 * @param scrollTop - Current vertical scroll position.
 * @returns Stable row ID at the viewport top, or null when no row exists.
 */
function findViewportAnchorRowId(
  rows: readonly EditorCurrentLine[],
  offsets: readonly number[],
  scrollTop: number,
): string | null {
  let anchorIndex = 0;
  while (
    anchorIndex + 1 < rows.length &&
    (offsets[anchorIndex + 1] ?? 0) <= scrollTop
  ) {
    anchorIndex += 1;
  }
  return rows[anchorIndex]?.id ?? null;
}

/** Converts a semantic projection ID to a document-safe row ID. */
function createDomRowId(rowId: string): string {
  return `current-file-viewer-row-${rowId}`;
}
