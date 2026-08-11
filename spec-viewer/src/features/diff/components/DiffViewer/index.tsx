import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ReactElement,
  type UIEvent,
  useEffect,
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
  calculateRowOffsets,
  calculateVisibleWindow,
  type DiffCell,
  type DiffSegment,
  type DiffViewMode,
  type DiffViewRow,
  findAdjacentChangeIndex,
  materializeRows,
} from "@/features/diff/lib/diffViewModel";

export type DiffViewerProps = Readonly<{
  fileDiff: FileDiff;
  mode: DiffProjectionViewMode;
  activeChangeId: string | null;
  onActiveChangeIdChange: (changeId: string | null) => void;
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
  const { fileDiff, mode, activeChangeId, onActiveChangeIdChange } = props;
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
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const pendingFrameRef = useRef<number | null>(null);
  const filePath =
    fileDiff.review.file.newPath ??
    fileDiff.review.file.oldPath ??
    fileDiff.identity.path;

  useEffect(() => {
    if (
      activeChangeId !== null &&
      resolvedActiveChangeId !== activeChangeId
    ) {
      onActiveChangeIdChange(resolvedActiveChangeId);
    }
  }, [activeChangeId, onActiveChangeIdChange, resolvedActiveChangeId]);

  useEffect(() => {
    setExpandedGapIds(new Set());
    setScrollTop(0);
    if (scrollSurfaceRef.current !== null) {
      scrollSurfaceRef.current.scrollTop = 0;
    }
  }, [fileDiff.identity.sourceId, fileDiff.identity.path, fileDiff.review]);

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
    };
  }, []);

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

  const projectionMode = toProjectionMode(mode);
  const rows = materializeRows(model, projectionMode, expandedGapIds);
  const offsets = calculateRowOffsets(rows);
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
  const activeIndex =
    resolvedActiveChangeId === null
      ? -1
      : model.changeIds.indexOf(resolvedActiveChangeId);
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < model.changeIds.length - 1;

  const navigate = (direction: "previous" | "next"): void => {
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

  const expandGap = (gapId: string): void => {
    setExpandedGapIds((current) => new Set([...current, gapId]));
  };

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
      >
        <div
          style={{ height: visibleWindow.topSpacerHeight }}
          aria-hidden="true"
        />
        {visibleRows.map((row) => (
          <DiffRow
            key={row.id}
            row={row}
            mode={projectionMode}
            activeChangeId={resolvedActiveChangeId}
            onExpandGap={expandGap}
          />
        ))}
        <div
          style={{ height: visibleWindow.bottomSpacerHeight }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

function DiffRow(
  props: Readonly<{
    row: DiffViewRow;
    mode: DiffViewMode;
    activeChangeId: string | null;
    onExpandGap: (gapId: string) => void;
  }>,
): ReactElement {
  const { row, mode, activeChangeId, onExpandGap } = props;
  if (row.kind === "hunk") {
    return (
      <div
        className="diff-viewer__row diff-viewer__hunk"
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
        data-row-kind="content"
        data-change-id={row.changeId ?? undefined}
        data-active={isActive}
        role="row"
      >
        <DiffCellView cell={row.old} side="old" />
        <DiffCellView cell={row.next} side="new" />
      </div>
    );
  }

  return (
    <div
      className="diff-viewer__row diff-viewer__row--inline"
      data-row-kind="content"
      data-change-id={row.changeId ?? undefined}
      data-active={isActive}
      role="row"
    >
      <DiffCellView cell={row.inline} side="inline" />
    </div>
  );
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
  }>,
): ReactElement {
  const { cell, side } = props;
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
  return (
    <div
      className="diff-viewer__cell"
      data-kind={cell.line.kind}
      data-side={side}
      role="gridcell"
      aria-label={getCellAccessibleLabel(cell, side)}
    >
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
