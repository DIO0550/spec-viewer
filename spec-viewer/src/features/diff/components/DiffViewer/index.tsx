import { ChevronLeft, ChevronRight, Columns2, Rows3 } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type UIEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { FileDiff, OmissionReason } from "@/features/diff/domain/fileDiff";
import {
  buildDiffViewModel,
  calculateRowOffsets,
  calculateVisibleWindow,
  findAdjacentChangeIndex,
  materializeRows,
  type DiffCell,
  type DiffSegment,
  type DiffViewMode,
  type DiffViewRow,
} from "@/features/diff/lib/diffViewModel";

export type DiffViewerProps = Readonly<{ fileDiff: FileDiff }>;

const OmissionMessages = {
  binary: "バイナリファイルのため差分を表示できません。",
  largeFile: "ファイルが大きすぎるため差分を表示できません。",
  diffLimit: "差分行数の上限を超えたため表示できません。",
  missingSide: "比較対象の片側が取得できないため差分を表示できません。",
  unsupportedEntryKind: "未対応のファイル種類のため差分を表示できません。",
} satisfies Record<OmissionReason, string>;

const ViewModes: readonly DiffViewMode[] = ["inline", "sideBySide"];
const OverscanRows = 100;
const SemanticRowHardCap = 500;

/**
 * Displays an immutable FileDiff as an interactive editor-like comparison.
 *
 * @param props - Decoded diff input without loading or IPC concerns.
 * @returns The ready viewer or a clear empty/omitted state.
 */
export function DiffViewer({ fileDiff }: DiffViewerProps): ReactElement {
  const model = useMemo(() => buildDiffViewModel(fileDiff), [fileDiff]);
  const [mode, setMode] = useState<DiffViewMode>("inline");
  const [activeChangeId, setActiveChangeId] = useState<string | null>(
    () => model.changeIds[0] ?? null,
  );
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
    fileDiff.fileKey;

  useEffect(() => {
    setActiveChangeId(model.changeIds[0] ?? null);
    setExpandedGapIds(new Set());
    setScrollTop(0);
    if (scrollSurfaceRef.current !== null) {
      scrollSurfaceRef.current.scrollTop = 0;
    }
  }, [fileDiff.fileKey, model.changeIds]);

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
    };
  }, []);

  if (model.state === "empty") {
    return (
      <DiffViewerFrame filePath={filePath} statusLabel={model.status.label}>
        <p className="diff-viewer__state" role="status">
          このファイルに表示できる行変更はありません。
        </p>
      </DiffViewerFrame>
    );
  }

  if (model.state === "omitted") {
    const reason = model.omissionReason ?? "diffLimit";
    return (
      <DiffViewerFrame filePath={filePath} statusLabel={model.status.label}>
        <p className="diff-viewer__state" role="status">
          {OmissionMessages[reason]}
        </p>
      </DiffViewerFrame>
    );
  }

  const rows = materializeRows(model, mode, expandedGapIds);
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
    activeChangeId === null ? -1 : model.changeIds.indexOf(activeChangeId);
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < model.changeIds.length - 1;

  const navigate = (direction: "previous" | "next"): void => {
    const nextIndex = findAdjacentChangeIndex(
      model.changeIds,
      activeChangeId,
      direction,
    );
    if (nextIndex === null) {
      return;
    }

    const nextChangeId = model.changeIds[nextIndex];
    if (nextChangeId === undefined) {
      return;
    }
    setActiveChangeId(nextChangeId);
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

  const handleModeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: DiffViewMode,
  ): void => {
    const currentIndex = ViewModes.indexOf(currentMode);
    let nextMode: DiffViewMode | undefined;
    if (event.key === "ArrowRight") {
      nextMode = ViewModes[(currentIndex + 1) % ViewModes.length];
    } else if (event.key === "ArrowLeft") {
      nextMode =
        ViewModes[(currentIndex - 1 + ViewModes.length) % ViewModes.length];
    }
    if (nextMode === undefined) {
      return;
    }
    event.preventDefault();
    setMode(nextMode);
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
    <DiffViewerFrame filePath={filePath} statusLabel={model.status.label}>
      <div className="diff-viewer__toolbar">
        <div
          className="diff-viewer__mode-control"
          role="radiogroup"
          aria-label="差分表示形式"
        >
          {ViewModes.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={mode === candidate}
              onClick={() => setMode(candidate)}
              onKeyDown={(event) => handleModeKeyDown(event, candidate)}
            >
              {candidate === "inline" ? (
                <Rows3 aria-hidden="true" size={14} />
              ) : (
                <Columns2 aria-hidden="true" size={14} />
              )}
              {candidate === "inline" ? "Inline" : "Side by side"}
            </button>
          ))}
        </div>
        <div
          className="diff-viewer__navigation"
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
      </div>
      <div
        ref={scrollSurfaceRef}
        className="diff-viewer__scroll-surface"
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
            mode={mode}
            activeChangeId={activeChangeId}
            onExpandGap={expandGap}
          />
        ))}
        <div
          style={{ height: visibleWindow.bottomSpacerHeight }}
          aria-hidden="true"
        />
      </div>
    </DiffViewerFrame>
  );
}

function DiffViewerFrame(
  props: Readonly<{
    filePath: string;
    statusLabel: string;
    children: ReactNode;
  }>,
): ReactElement {
  return (
    <section className="diff-viewer" aria-label={`${props.filePath} の差分`}>
      <header className="diff-viewer__header">
        <strong>{props.filePath}</strong>
        <span className="diff-viewer__status">{props.statusLabel}</span>
      </header>
      {props.children}
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
      <div className="diff-viewer__row diff-viewer__hunk" data-row-kind="hunk">
        {row.header}
      </div>
    );
  }
  if (row.kind === "annotation") {
    return (
      <div
        className="diff-viewer__row diff-viewer__annotation"
        data-row-kind="annotation"
        data-side={row.side}
      >
        {row.text}
      </div>
    );
  }
  if (row.kind === "gap") {
    return (
      <div className="diff-viewer__row diff-viewer__gap" data-row-kind="gap">
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
    >
      <DiffCellView cell={row.inline} side="inline" />
    </div>
  );
}

function DiffCellView(
  props: Readonly<{
    cell: DiffCell | null;
    side: "old" | "new" | "inline";
  }>,
): ReactElement {
  const { cell, side } = props;
  if (cell === null) {
    return (
      <div
        className="diff-viewer__cell diff-viewer__cell--spacer"
        aria-hidden="true"
      />
    );
  }

  const marker = getLineMarker(cell.line.kind);
  return (
    <div
      className="diff-viewer__cell"
      data-kind={cell.line.kind}
      data-side={side}
    >
      {side === "inline" ? (
        <>
          <span className="diff-viewer__line-number">
            {cell.line.oldLineNumber ?? ""}
          </span>
          <span className="diff-viewer__line-number">
            {cell.line.newLineNumber ?? ""}
          </span>
        </>
      ) : (
        <span className="diff-viewer__line-number">
          {side === "old"
            ? (cell.line.oldLineNumber ?? "")
            : (cell.line.newLineNumber ?? "")}
        </span>
      )}
      <span className="diff-viewer__marker" aria-hidden="true">
        {marker}
      </span>
      <code>{renderSegments(cell.segments)}</code>
    </div>
  );
}

function getLineMarker(kind: DiffCell["line"]["kind"]): string {
  if (kind === "added") {
    return "+";
  }
  if (kind === "removed") {
    return "-";
  }

  return " ";
}

function renderSegments(
  segments: readonly DiffSegment[],
): readonly ReactElement[] {
  return segments.map((segment, index) => (
    <span key={`${index}-${segment.kind}`} data-segment-kind={segment.kind}>
      {segment.text || " "}
    </span>
  ));
}
