type Props = Readonly<{
  label: string;
  rows: readonly SkeletonRow[];
  className?: string;
}>;

type SkeletonRow = Readonly<{
  width: "short" | "medium" | "long" | "full";
}>;

/**
 * @param rows - Skeleton bar definitions in display order
 * @returns Rows keyed by width and per-width occurrence so keys stay stable.
 */
function createKeyedRows(
  rows: readonly SkeletonRow[],
): readonly (SkeletonRow & { key: string })[] {
  const occurrenceByWidth = new Map<SkeletonRow["width"], number>();

  return rows.map((row) => {
    const occurrence = occurrenceByWidth.get(row.width) ?? 0;
    occurrenceByWidth.set(row.width, occurrence + 1);

    return { ...row, key: `${row.width}-${occurrence}` };
  });
}

/**
 * @param props - Status label, skeleton rows, and optional class name
 * @returns A stable loading placeholder with an accessible status label.
 */
export function LoadingSkeleton({ label, rows, className }: Props) {
  const classNames =
    className === undefined
      ? "loading-skeleton"
      : `loading-skeleton ${className}`;

  return (
    <div className={classNames} aria-label={label} role="status">
      <span className="loading-skeleton__label">{label}</span>
      <div className="loading-skeleton__rows" aria-hidden="true">
        {createKeyedRows(rows).map((row) => (
          <span
            className="loading-skeleton__bar"
            data-width={row.width}
            key={row.key}
          />
        ))}
      </div>
    </div>
  );
}
