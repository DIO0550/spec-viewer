import { AlertTriangle } from "lucide-react";

import type { NormalizedCommandError } from "../types/ipc";

type Props = Readonly<{
  title: string;
  error: NormalizedCommandError;
  actionLabel?: string;
  onAction?: () => void;
}>;

/** @returns A command failure message with optional retry and diagnostic context. */
export function CommandErrorDisplay({
  title,
  error,
  actionLabel,
  onAction,
}: Props) {
  return (
    <section className="command-error" role="alert">
      <AlertTriangle aria-hidden="true" size={20} />
      <div className="command-error__content">
        <h2>{title}</h2>
        <p>{error.message}</p>
        <dl className="command-error__details">
          <div>
            <dt>Command</dt>
            <dd>{error.code}</dd>
          </div>
        </dl>
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
