import { AlertTriangle } from "lucide-react";

type Props = Readonly<{
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}>;

/** @returns A reusable error message with an optional retry action. */
export function ErrorState({ title, message, actionLabel, onAction }: Props) {
  return (
    <section className="error-state" role="alert">
      <AlertTriangle aria-hidden="true" size={20} />
      <div className="error-state__content">
        <h2>{title}</h2>
        <p>{message}</p>
        {actionLabel === undefined || onAction === undefined ? null : (
          <button
            className="button button--secondary"
            type="button"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
