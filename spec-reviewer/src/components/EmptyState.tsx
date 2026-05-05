import type { ReactNode } from "react";

type Props = Readonly<{
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "panel" | "inline";
}>;

/** @returns A reusable empty-state message for inactive viewer surfaces. */
export function EmptyState({
  title,
  description,
  action,
  variant = "panel",
}: Props) {
  return (
    <section
      className={`empty-state empty-state--${variant}`}
      aria-live="polite"
    >
      <h2>{title}</h2>
      {description === undefined ? null : <p>{description}</p>}
      {action === undefined ? null : (
        <div className="empty-state__action">{action}</div>
      )}
    </section>
  );
}
