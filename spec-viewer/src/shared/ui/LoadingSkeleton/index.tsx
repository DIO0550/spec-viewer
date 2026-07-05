type Props = Readonly<{
  label: string;
  rows: readonly SkeletonRow[];
  className?: string;
}>;

type SkeletonRow = Readonly<{
  width: "short" | "medium" | "long" | "full";
}>;

/**
 * A stable loading placeholder with an accessible status label.
 * @param props - Component props: label, rows and optional className.
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
        {rows.map((row, index) => (
          <span
            className="loading-skeleton__bar"
            data-width={row.width}
            key={`${row.width}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
