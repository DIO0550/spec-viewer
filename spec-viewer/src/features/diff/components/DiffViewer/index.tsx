import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ReactElement,
  memo,
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  DiffProjectionViewMode,
  FileDiff,
  OmissionReason,
} from "@/features/diff/domain/fileDiff";
import {
  buildDiffViewModel,
  calculateVisibleWindow,
  type DiffCell,
  type DiffSegment,
  type DiffViewMode,
  type DiffViewRow,
  findAdjacentChangeIndex,
  materializeRows,
} from "@/features/diff/lib/diffViewModel";
import {
  calculateMixedHeightOffsets,
  type HeightMeasurementCache,
  mergeMeasuredHeights,
} from "@/features/diff/lib/editorWindowing";
import type { DiffLineCommentTarget } from "@/features/diffComments/components/DiffLineCommentControl";
import {
  DiffLineCommentSlot,
  type DiffCommentJumpTarget,
  type DiffLineCommentsController,
} from "@/features/diffComments/components/DiffLineCommentSlot";

import { focusCommentTarget } from "@/features/diffComments/components/commentNavigation";
export type DiffViewerProps = Readonly<{
  fileDiff: FileDiff;
  mode: DiffProjectionViewMode;
  activeChangeId: string | null;
  onActiveChangeIdChange: (changeId: string | null) => void;
  lineComments?: DiffLineCommentsController;
  commentJumpTarget?: DiffCommentJumpTarget | null;
}>;

const OmissionMessages = {
  binary: "バイナリファイルのため差分を表示できません。",
  largeFile: "ファイルが大きすぎるため差分を表示できません。",
  diffLimit: "差分行数の上限を超えたため表示できません。",
  missingSide: "比較対象の片側が取得できないため差分を表示できません。",
  unsupportedEntryKind: "未対応のファイル種類のため差分を表示できません。",
} satisfies Record<OmissionReason, string>;

const OverscanRows = 100;
const SemanticRowHardCap = 500;

/**
 * Maps the public viewer mode to the internal row projection mode.
 *
 * @param mode - Controlled public projection mode.
 * @returns Internal projection mode used by the row model.
 */
function toProjectionMode(mode: DiffProjectionViewMode): DiffViewMode {
  return mode === "unified" ? "inline" : "sideBySide";
}

/**
 * Displays an immutable FileDiff with controlled layout and jump state.
 *
 * @param props - Diff input, projection mode, and active change contract.
 * @returns The ready viewer or a clear empty/omitted state.
 */
export function DiffViewer(props: DiffViewerProps): ReactElement {
  const {
    fileDiff,
    mode,
    activeChangeId,
    onActiveChangeIdChange,
    lineComments,
    commentJumpTarget,
  } = props;
  const model = useMemo(
    () => buildDiffViewModel(fileDiff),
    [
      fileDiff.identity.sourceId,
      fileDiff.identity.path,
      fileDiff.review,
      fileDiff.availability,
    ],
  );
  const resolvedActiveChangeId =
    activeChangeId !== null && model.changeIds.includes(activeChangeId)
      ? activeChangeId
      : (model.changeIds[0] ?? null);
  const [expandedGapIds, setExpandedGapIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [forcedCommentRowIndex, setForcedCommentRowIndex] = useState<
    number | null
  >(null);
  const [commentFocusAttempt, setCommentFocusAttempt] = useState(0);
  const [pendingCommentFocusKey, setPendingCommentFocusKey] = useState<
    string | null
  >(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measurements, setMeasurements] = useState<HeightMeasurementCache>({});
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const pendingFrameRef = useRef<number | null>(null);
  const pendingMeasurementFrameRef = useRef<number | null>(null);
  const pendingMeasurementsRef = useRef<Record<string, number>>({});
  const measurementsRef = useRef<HeightMeasurementCache>({});
  const rowsRef = useRef<readonly DiffViewRow[]>([]);

  const filePath =
    fileDiff.review.file.newPath ??
    fileDiff.review.file.oldPath ??
    fileDiff.identity.path;

  const projectionMode = toProjectionMode(mode);
  const rows = useMemo(
    () => materializeRows(model, projectionMode, expandedGapIds),
    [expandedGapIds, model, projectionMode],
  );
  rowsRef.current = rows;
  measurementsRef.current = measurements;
  const offsets = useMemo(
    () => calculateMixedHeightOffsets(rows, measurements),
    [measurements, rows],
  );
  useEffect(() => {
    if (activeChangeId !== null && resolvedActiveChangeId !== activeChangeId) {
      onActiveChangeIdChange(resolvedActiveChangeId);
    }
  }, [activeChangeId, onActiveChangeIdChange, resolvedActiveChangeId]);

  useEffect(() => {
    setExpandedGapIds(new Set());
    setScrollTop(0);
    setMeasurements({});
    measurementsRef.current = {};
    pendingMeasurementsRef.current = {};
    if (scrollSurfaceRef.current !== null) {
      scrollSurfaceRef.current.scrollTop = 0;
    }
  }, [
    fileDiff.identity.sourceId,
    fileDiff.identity.path,
    fileDiff.review,
    projectionMode,
  ]);

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

  useEffect(() => {
    if (commentJumpTarget === null || commentJumpTarget === undefined) {
      return;
    }
    const targetIndex = rows.findIndex((row) =>
      rowContainsCommentTarget(
        row,
        projectionMode,
        fileDiff.review.file.oldPath,
        fileDiff.review.file.newPath,
        commentJumpTarget,
      ),
    );
    if (targetIndex < 0) {
      const foldedRows =
        projectionMode === "inline" ? model.inlineRows : model.sideBySideRows;
      const containingGap = foldedRows.find(
        (row) =>
          row.kind === "gap" &&
          row.expandableRows !== null &&
          row.expandableRows.some((expandedRow) =>
            rowContainsCommentTarget(
              expandedRow,
              projectionMode,
              fileDiff.review.file.oldPath,
              fileDiff.review.file.newPath,
              commentJumpTarget,
            ),
          ),
      );
      if (containingGap !== undefined) {
        setExpandedGapIds((current) => new Set([...current, containingGap.id]));
      }
      return;
    }
    const nextScrollTop = offsets[targetIndex] ?? 0;
    setForcedCommentRowIndex(targetIndex);
    setScrollTop(nextScrollTop);
    if (scrollSurfaceRef.current !== null) {
      scrollSurfaceRef.current.scrollTop = nextScrollTop;
    }
    setPendingCommentFocusKey(commentJumpTarget.key);
  }, [
    commentJumpTarget?.requestId,
    expandedGapIds,
    fileDiff.review.file.newPath,
    fileDiff.review.file.oldPath,
    model,
    projectionMode,
  ]);

  useLayoutEffect(() => {
    const pendingKey = pendingCommentFocusKey;
    if (pendingKey === null) {
      return;
    }
    const hasTarget = Array.from(
      scrollSurfaceRef.current?.querySelectorAll<HTMLElement>(
        "[data-comment-target-key]",
      ) ?? [],
    ).some((candidate) => candidate.dataset.commentTargetKey === pendingKey);
    if (!hasTarget) {
      const frameId = requestAnimationFrame(() => {
        setCommentFocusAttempt((current) => current + 1);
      });
      return () => cancelAnimationFrame(frameId);
    }
    focusCommentTarget(scrollSurfaceRef.current, pendingKey);
    setPendingCommentFocusKey(null);
    setCommentFocusAttempt(0);
  }, [commentFocusAttempt, pendingCommentFocusKey, rows, scrollTop]);

  if (model.state === "empty") {
    return (
      <section className="diff-viewer" aria-label={`${filePath} の差分`}>
        <p className="diff-viewer__state" role="status">
          このファイルに表示できる行変更はありません。
        </p>
      </section>
    );
  }

  if (model.state === "omitted") {
    const reason = model.omissionReason ?? "diffLimit";
    return (
      <section className="diff-viewer" aria-label={`${filePath} の差分`}>
        <p className="diff-viewer__state" role="status">
          {OmissionMessages[reason]}
        </p>
      </section>
    );
  }

  const visibleWindow = calculateVisibleWindow({
    offsets,
    scrollTop,
    viewportHeight,
    overscanRows: OverscanRows,
    hardCap: SemanticRowHardCap,
  });
  const forcedWindowStart =
    forcedCommentRowIndex === null
      ? null
      : Math.min(
          Math.max(
            0,
            forcedCommentRowIndex - Math.floor(SemanticRowHardCap / 2),
          ),
          Math.max(0, rows.length - SemanticRowHardCap),
        );
  const renderedStartIndex = forcedWindowStart ?? visibleWindow.startIndex;
  const renderedEndIndex =
    forcedWindowStart === null
      ? visibleWindow.endIndex
      : Math.min(rows.length, forcedWindowStart + SemanticRowHardCap);
  const visibleRows = rows.slice(renderedStartIndex, renderedEndIndex);
  const renderedTopSpacerHeight = offsets[renderedStartIndex] ?? 0;
  const totalHeight = offsets[rows.length] ?? 0;
  const renderedBottomSpacerHeight = Math.max(
    0,
    totalHeight - (offsets[renderedEndIndex] ?? totalHeight),
  );
  const activeIndex =
    resolvedActiveChangeId === null
      ? -1
      : model.changeIds.indexOf(resolvedActiveChangeId);
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < model.changeIds.length - 1;

  const navigate = (direction: "previous" | "next"): void => {
    setForcedCommentRowIndex(null);
    const nextIndex = findAdjacentChangeIndex(
      model.changeIds,
      resolvedActiveChangeId,
      direction,
    );
    if (nextIndex === null) {
      return;
    }

    const nextChangeId = model.changeIds[nextIndex];
    if (nextChangeId === undefined) {
      return;
    }
    onActiveChangeIdChange(nextChangeId);
    const targetRowIndex = rows.findIndex(
      (row) => row.kind === "content" && row.changeId === nextChangeId,
    );
    if (targetRowIndex < 0) {
      return;
    }
    const nextScrollTop = offsets[targetRowIndex] ?? 0;
    setScrollTop(nextScrollTop);
    if (scrollSurfaceRef.current !== null) {
      scrollSurfaceRef.current.scrollTop = nextScrollTop;
    }
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>): void => {
    const element = event.currentTarget;
    if (pendingFrameRef.current !== null) {
      cancelAnimationFrame(pendingFrameRef.current);
    }
    pendingFrameRef.current = requestAnimationFrame(() => {
      setScrollTop(element.scrollTop);
      setViewportHeight(element.clientHeight);
      pendingFrameRef.current = null;
    });
  };

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
        const currentMeasurements = measurementsRef.current;
        const nextMeasurements = mergeMeasuredHeights(
          currentMeasurements,
          pendingMeasurementsRef.current,
        );
        pendingMeasurementsRef.current = {};
        pendingMeasurementFrameRef.current = null;
        if (nextMeasurements === currentMeasurements) {
          return;
        }

        const currentRows = rowsRef.current;
        const previousOffsets = calculateMixedHeightOffsets(
          currentRows,
          currentMeasurements,
        );
        const surface = scrollSurfaceRef.current;
        if (surface !== null) {
          let anchorIndex = 0;
          while (
            anchorIndex + 1 < currentRows.length &&
            (previousOffsets[anchorIndex + 1] ?? 0) <= surface.scrollTop
          ) {
            anchorIndex += 1;
          }
          const anchorRowId = currentRows[anchorIndex]?.id;
          if (anchorRowId !== undefined) {
            const nextOffsets = calculateMixedHeightOffsets(
              currentRows,
              nextMeasurements,
            );
            const previousAnchorOffset = previousOffsets[anchorIndex] ?? 0;
            const nextAnchorOffset = nextOffsets[anchorIndex] ?? 0;
            const nextScrollTop =
              nextAnchorOffset + surface.scrollTop - previousAnchorOffset;
            surface.scrollTop = nextScrollTop;
            setScrollTop(nextScrollTop);
          }
        }
        measurementsRef.current = nextMeasurements;
        setMeasurements(nextMeasurements);
      });
    },
    [],
  );

  const expandGap = useCallback((gapId: string): void => {
    setExpandedGapIds((current) => new Set([...current, gapId]));
  }, []);

  return (
    <section className="diff-viewer" aria-label={`${filePath} の差分`}>
      <div
        className="diff-viewer__navigation"
        role="group"
        aria-label="変更箇所ナビゲーション"
      >
        <button
          type="button"
          aria-label="前の変更"
          disabled={!hasPrevious}
          onClick={() => navigate("previous")}
        >
          <ChevronLeft aria-hidden="true" size={14} />
        </button>
        <span aria-live="polite">
          {activeIndex < 0 ? 0 : activeIndex + 1} / {model.changeIds.length}
        </span>
        <button
          type="button"
          aria-label="次の変更"
          disabled={!hasNext}
          onClick={() => navigate("next")}
        >
          <ChevronRight aria-hidden="true" size={14} />
        </button>
      </div>
      <div
        ref={scrollSurfaceRef}
        className="diff-viewer__scroll-surface"
        role="grid"
        aria-label={filePath + " の差分行"}
        tabIndex={0}
        onScroll={handleScroll}
        onWheel={() => setForcedCommentRowIndex(null)}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setForcedCommentRowIndex(null);
          }
        }}
        onKeyDown={(event) => {
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "PageUp",
              "PageDown",
              "Home",
              "End",
            ].includes(event.key)
          ) {
            setForcedCommentRowIndex(null);
          }
        }}
      >
        <div style={{ height: renderedTopSpacerHeight }} aria-hidden="true" />
        {visibleRows.map((row) => (
          <DiffRow
            key={row.id}
            row={row}
            mode={projectionMode}
            activeChangeId={resolvedActiveChangeId}
            onExpandGap={expandGap}
            oldPath={fileDiff.review.file.oldPath}
            newPath={fileDiff.review.file.newPath}
            lineComments={lineComments}
            onMeasure={measureRow}
          />
        ))}
        <div
          style={{ height: renderedBottomSpacerHeight }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

type DiffRowProps = Readonly<{
  row: DiffViewRow;
  mode: DiffViewMode;
  activeChangeId: string | null;
  onExpandGap: (gapId: string) => void;
  oldPath: string | null;
  newPath: string | null;
  lineComments?: DiffLineCommentsController;
  onMeasure: (rowId: string, element: HTMLDivElement | null) => void;
}>;

const DiffRow = memo(function DiffRow(props: DiffRowProps): ReactElement {
  const {
    row,
    mode,
    activeChangeId,
    onExpandGap,
    oldPath,
    newPath,
    lineComments,
    onMeasure,
  } = props;
  if (row.kind === "hunk") {
    return (
      <div
        className="diff-viewer__row diff-viewer__hunk"
        ref={(element) => onMeasure(row.id, element)}
        data-row-kind="hunk"
        role="row"
        aria-label={row.header}
      >
        <div role="gridcell" aria-colspan={mode === "sideBySide" ? 2 : 1}>
          {row.header}
        </div>
      </div>
    );
  }
  if (row.kind === "annotation") {
    return (
      <div
        className="diff-viewer__row diff-viewer__annotation"
        ref={(element) => onMeasure(row.id, element)}
        data-row-kind="annotation"
        data-side={row.side}
        role="row"
        aria-label={row.side + " side note: " + row.text}
      >
        <div role="gridcell" aria-colspan={mode === "sideBySide" ? 2 : 1}>
          {row.text}
        </div>
      </div>
    );
  }
  if (row.kind === "gap") {
    return (
      <div
        className="diff-viewer__row diff-viewer__gap"
        ref={(element) => onMeasure(row.id, element)}
        data-row-kind="gap"
        role="row"
        aria-label={"コンテキスト " + row.omittedLineCount + " 行を省略"}
      >
        <div role="gridcell" aria-colspan={mode === "sideBySide" ? 2 : 1}>
          {row.expandableRows === null ? (
            <span>
              … {row.omittedLineCount}
              行のコンテキストを省略（内容を取得できません）
            </span>
          ) : (
            <button type="button" onClick={() => onExpandGap(row.id)}>
              省略した{row.omittedLineCount}行を展開
            </button>
          )}
        </div>
      </div>
    );
  }

  const isActive = row.changeId !== null && row.changeId === activeChangeId;
  if (mode === "sideBySide") {
    return (
      <div
        className="diff-viewer__row diff-viewer__row--split"
        ref={(element) => onMeasure(row.id, element)}
        data-row-kind="content"
        data-change-id={row.changeId ?? undefined}
        data-active={isActive}
        role="row"
      >
        <DiffCellView
          cell={row.old}
          side="old"
          oldPath={oldPath}
          newPath={newPath}
          lineComments={lineComments}
        />
        <DiffCellView
          cell={row.next}
          side="new"
          oldPath={oldPath}
          newPath={newPath}
          lineComments={lineComments}
        />
      </div>
    );
  }

  return (
    <div
      className="diff-viewer__row diff-viewer__row--inline"
      ref={(element) => onMeasure(row.id, element)}
      data-row-kind="content"
      data-change-id={row.changeId ?? undefined}
      data-active={isActive}
      role="row"
    >
      <DiffCellView
        cell={row.inline}
        side="inline"
        oldPath={oldPath}
        newPath={newPath}
        lineComments={lineComments}
      />
    </div>
  );
}, areDiffRowPropsEqual);

function areDiffRowPropsEqual(
  previous: DiffRowProps,
  next: DiffRowProps,
): boolean {
  if (
    previous.row !== next.row ||
    previous.mode !== next.mode ||
    previous.oldPath !== next.oldPath ||
    previous.newPath !== next.newPath ||
    previous.onExpandGap !== next.onExpandGap ||
    previous.onMeasure !== next.onMeasure ||
    isActiveRow(previous.row, previous.activeChangeId) !==
      isActiveRow(next.row, next.activeChangeId)
  ) {
    return false;
  }
  return haveEqualCommentState(previous, next);
}

function isActiveRow(row: DiffViewRow, activeChangeId: string | null): boolean {
  return row.kind === "content" && row.changeId === activeChangeId;
}

function haveEqualCommentState(
  previous: DiffRowProps,
  next: DiffRowProps,
): boolean {
  if (previous.lineComments === next.lineComments) {
    return true;
  }
  if (previous.lineComments === undefined || next.lineComments === undefined) {
    return false;
  }
  const targets = getRowCommentTargets(
    previous.row,
    previous.mode,
    previous.oldPath,
    previous.newPath,
  );
  return targets.every((target) => {
    const previousComments =
      previous.lineComments?.commentsByTarget[target.key] ?? [];
    const nextComments = next.lineComments?.commentsByTarget[target.key] ?? [];
    const previousIsSelected = previousComments.some(
      (comment) => comment.id === previous.lineComments?.activeCommentId,
    );
    const nextIsSelected = nextComments.some(
      (comment) => comment.id === next.lineComments?.activeCommentId,
    );
    const previousDraft =
      previous.lineComments?.draft?.target.key === target.key
        ? previous.lineComments.draft
        : null;
    const nextDraft =
      next.lineComments?.draft?.target.key === target.key
        ? next.lineComments.draft
        : null;
    return (
      haveEqualCommentSummaries(previousComments, nextComments) &&
      previousIsSelected === nextIsSelected &&
      previousDraft === nextDraft
    );
  });
}

function haveEqualCommentSummaries(
  previous: readonly { id: string; createdAt: string; label: string }[],
  next: readonly { id: string; createdAt: string; label: string }[],
): boolean {
  return (
    previous.length === next.length &&
    previous.every((comment, index) => {
      const candidate = next[index];
      return (
        candidate !== undefined &&
        candidate.id === comment.id &&
        candidate.createdAt === comment.createdAt &&
        candidate.label === comment.label
      );
    })
  );
}

function getRowCommentTargets(
  row: DiffViewRow,
  mode: DiffViewMode,
  oldPath: string | null,
  newPath: string | null,
): readonly DiffLineCommentTarget[] {
  if (row.kind !== "content") {
    return [];
  }
  if (mode === "inline") {
    return row.inline === null
      ? []
      : getCommentTargets(row.inline, "inline", oldPath, newPath);
  }
  return [
    ...(row.old === null
      ? []
      : getCommentTargets(row.old, "old", oldPath, newPath)),
    ...(row.next === null
      ? []
      : getCommentTargets(row.next, "new", oldPath, newPath)),
  ];
}

/**
 * Renders one side of a diff row, or an empty spacer cell when the line has
 * no counterpart on this side.
 *
 * @param props - The cell to render (or null for a spacer) and which side
 *   it belongs to.
 * @returns The rendered cell element.
 */
function DiffCellView(
  props: Readonly<{
    cell: DiffCell | null;
    side: "old" | "new" | "inline";
    oldPath: string | null;
    newPath: string | null;
    lineComments?: DiffLineCommentsController;
  }>,
): ReactElement {
  const { cell, side, oldPath, newPath, lineComments } = props;
  if (cell === null) {
    const sideLabel = side === "old" ? "旧側" : "新側";
    return (
      <div
        className="diff-viewer__cell diff-viewer__cell--spacer"
        data-side={side}
        role="gridcell"
        aria-label={sideLabel + "に対応する行なし"}
      />
    );
  }

  const marker = getLineMarker(cell.line.kind);
  const commentTargets = getCommentTargets(cell, side, oldPath, newPath);
  return (
    <div
      className="diff-viewer__cell"
      data-kind={cell.line.kind}
      data-side={side}
      role="gridcell"
      aria-label={getCellAccessibleLabel(cell, side)}
    >
      <div className="diff-viewer__comment-lane">
        {lineComments === undefined
          ? null
          : commentTargets.map((target) => (
              <DiffLineCommentSlot
                key={target.key}
                target={target}
                controller={lineComments}
              />
            ))}
      </div>
      {side === "inline" ? (
        <>
          <span className="diff-viewer__line-number" aria-hidden="true">
            {cell.line.oldLineNumber ?? ""}
          </span>
          <span className="diff-viewer__line-number" aria-hidden="true">
            {cell.line.newLineNumber ?? ""}
          </span>
        </>
      ) : (
        <span className="diff-viewer__line-number" aria-hidden="true">
          {side === "old"
            ? (cell.line.oldLineNumber ?? "")
            : (cell.line.newLineNumber ?? "")}
        </span>
      )}
      <span className="diff-viewer__marker" aria-hidden="true">
        {marker}
      </span>
      <code aria-hidden="true">{renderSegments(cell.segments)}</code>
    </div>
  );
}

function rowContainsCommentTarget(
  row: DiffViewRow,
  mode: DiffViewMode,
  oldPath: string | null,
  newPath: string | null,
  target: DiffCommentJumpTarget,
): boolean {
  if (row.kind !== "content") {
    return false;
  }
  const cells = mode === "inline" ? [row.inline] : [row.old, row.next];
  return cells.some(
    (cell) =>
      cell !== null &&
      getCommentTargets(
        cell,
        mode === "inline" ? "inline" : target.side === "base" ? "old" : "new",
        oldPath,
        newPath,
      ).some((candidate) => candidate.key === target.key),
  );
}

function getCommentTargets(
  cell: DiffCell,
  side: "old" | "new" | "inline",
  oldPath: string | null,
  newPath: string | null,
): readonly DiffLineCommentTarget[] {
  if (cell.line.kind === "noNewline") {
    return [];
  }

  const targets: DiffLineCommentTarget[] = [];
  const includesBase = side !== "new" && cell.line.kind !== "added";
  const includesCurrent = side !== "old" && cell.line.kind !== "removed";

  if (includesBase && oldPath !== null && cell.line.oldLineNumber !== null) {
    targets.push(
      createCommentTarget(
        "base",
        oldPath,
        cell.line.oldLineNumber,
        oldPath,
        newPath,
      ),
    );
  }
  if (includesCurrent && newPath !== null && cell.line.newLineNumber !== null) {
    targets.push(
      createCommentTarget(
        "current",
        newPath,
        cell.line.newLineNumber,
        oldPath,
        newPath,
      ),
    );
  }
  return targets;
}

function createCommentTarget(
  side: "base" | "current",
  sidePath: string,
  line: number,
  oldPath: string | null,
  newPath: string | null,
): DiffLineCommentTarget {
  return {
    key: `${side}:${sidePath}:${line}`,
    side,
    sidePath,
    oldPath: oldPath ?? undefined,
    newPath: newPath ?? undefined,
    line,
  };
}

/**
 * Creates a screen-reader label for one rendered diff cell.
 *
 * @param cell - The diff cell to describe.
 * @param side - The visible side containing the cell.
 * @returns A localized accessible description.
 */
function getCellAccessibleLabel(
  cell: DiffCell,
  side: "old" | "new" | "inline",
): string {
  const sideLabel = getSideLabel(side);
  const kindLabel = getLineKindLabel(cell.line.kind);
  const lineLabel = getLineLabel(cell, side);

  return (
    sideLabel + "、" + kindLabel + "、" + lineLabel + "、" + cell.line.text
  );
}

/**
 * Resolves the visible side label.
 *
 * @param side - The visible side containing the cell.
 * @returns A localized side label.
 */
function getSideLabel(side: "old" | "new" | "inline"): string {
  if (side === "old") {
    return "旧ファイル";
  }
  if (side === "new") {
    return "新ファイル";
  }
  return "Unified";
}

/**
 * Resolves line-number text for the visible side.
 *
 * @param cell - The diff cell containing line numbers.
 * @param side - The visible side containing the cell.
 * @returns A localized line-number label.
 */
function getLineLabel(cell: DiffCell, side: "old" | "new" | "inline"): string {
  if (side === "inline") {
    return (
      "旧行 " +
      (cell.line.oldLineNumber ?? "なし") +
      "、新行 " +
      (cell.line.newLineNumber ?? "なし")
    );
  }
  if (side === "old") {
    return "旧行 " + (cell.line.oldLineNumber ?? "なし");
  }
  return "新行 " + (cell.line.newLineNumber ?? "なし");
}

/**
 * Resolves a localized line-kind label.
 *
 * @param kind - The domain line kind.
 * @returns A localized line-kind label.
 */
function getLineKindLabel(kind: DiffCell["line"]["kind"]): string {
  if (kind === "added") {
    return "追加";
  }
  if (kind === "removed") {
    return "削除";
  }
  if (kind === "noNewline") {
    return "改行なし";
  }

  return "コンテキスト";
}

/**
 * Maps a diff line kind to its gutter marker character.
 *
 * @param kind - The kind of the diff line.
 * @returns "+" for added lines, "-" for removed lines, otherwise a single
 *   space for context lines.
 */
function getLineMarker(kind: DiffCell["line"]["kind"]): string {
  if (kind === "added") {
    return "+";
  }
  if (kind === "removed") {
    return "-";
  }

  return " ";
}

/**
 * Renders each intraline diff segment as its own span so it can be styled
 * by segment kind (added/removed/unchanged).
 *
 * @param segments - Ordered intraline segments for one diff cell.
 * @returns One span element per segment, using a single space for empty
 *   segment text so the span retains layout height.
 */
function renderSegments(
  segments: readonly DiffSegment[],
): readonly ReactElement[] {
  return segments.map((segment, index) => (
    <span key={`${index}-${segment.kind}`} data-segment-kind={segment.kind}>
      {segment.text || " "}
    </span>
  ));
}
