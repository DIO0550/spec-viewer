import type { ReactElement } from "react";

import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";

export type ChangesNavigationItem = Readonly<{
  id: string;
  path: string;
  change?: FileChangeStatus | null;
  ignored?: boolean;
  deferredNodeId?: string | null;
}>;
export type ChangesNavigationAvailability =
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "unavailable"; reason: string }>
  | Readonly<{ status: "failed"; message: string }>;
export type ChangesNavigationProps = Readonly<{
  items: readonly ChangesNavigationItem[];
  selectedId: string | null;
  availability: ChangesNavigationAvailability;
  /**
   * Notifies the caller that a changed file was selected.
   *
   * @param id - The stable ID of the selected file.
   */
  onSelect: (id: string) => void;
  /** Requests a retry after a failed changed-file fetch. */
  onRetry?: () => void;
}>;

/**
 * Displays controlled changed-file navigation or a recoverable data state.
 *
 * @param props - Availability, files, selection and selection callback.
 * @returns Changes navigation for the mode-navigation slot.
 */
export function ChangesNavigation(props: ChangesNavigationProps): ReactElement {
  const { items, selectedId, availability, onSelect, onRetry } = props;

  if (availability.status === "loading") {
    return <ChangesStatus>変更ファイルを読み込んでいます。</ChangesStatus>;
  }

  if (availability.status === "failed") {
    return (
      <div className="changes-navigation__error" role="alert">
        <p>{availability.message}</p>
        {onRetry === undefined ? null : (
          <button type="button" onClick={onRetry}>
            再試行
          </button>
        )}
      </div>
    );
  }

  if (availability.status === "unavailable") {
    return (
      <ChangesStatus>
        {getUnavailableMessage(availability.reason)}
      </ChangesStatus>
    );
  }

  if (items.length === 0) {
    return <ChangesStatus>変更ファイルはありません。</ChangesStatus>;
  }

  return (
    <nav className="changes-navigation" aria-label="変更ファイル">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={item.id === selectedId ? "page" : undefined}
          onClick={() => {
            onSelect(item.id);
          }}
        >
          <span
            className="changes-navigation__change-token"
            aria-label={getChangeLabel(item.change, item.ignored === true)}
          >
            {getChangeToken(item.change, item.ignored === true)}
          </span>
          <span className="changes-navigation__path">{item.path}</span>
          {item.deferredNodeId === undefined ||
          item.deferredNodeId === null ? null : (
            <span
              className="changes-navigation__deferred"
              aria-label="遅延読み込みのディレクトリ"
            >
              …
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

/**
 * @param props - Status text.
 * @returns An announced Changes state.
 */
function ChangesStatus(props: Readonly<{ children: string }>): ReactElement {
  return (
    <p
      className="changes-navigation__status"
      role="status"
      aria-live="polite"
      aria-label="Changesデータ状態"
    >
      {props.children}
    </p>
  );
}

/**
 * Maps a known "unavailable" reason code to its user-facing message.
 *
 * @param reason - The unavailable reason code from the availability state.
 * @returns The message for known reason codes, or the raw reason string
 *   unchanged when it is not one of the known codes.
 */
function getUnavailableMessage(reason: string): string {
  if (reason === "contract-pending") {
    return "Changesの契約を確認中です。Specsモードで仕様の確認を続けられます。";
  }
  if (reason === "data-source-not-connected") {
    return "変更ファイル一覧はまだ利用できません。Specsモードで仕様の確認を続けられます。";
  }
  return reason;
}

const CHANGE_LABELS = {
  added: "追加",
  modified: "変更",
  deleted: "削除",
  renamed: "名前変更",
  copied: "コピー",
  typeChanged: "種別変更",
  untracked: "未追跡",
} as const satisfies Readonly<Record<FileChangeStatus, string>>;

/**
 * Reduces a file change status to its compact navigation token.
 *
 * @param change - The file's change status, or undefined when unknown.
 * @returns "U" for added/untracked files, "M" for every other change
 *   (including the undefined/unknown case).
 */
function getChangeToken(
  change: FileChangeStatus | null | undefined,
  ignored: boolean,
): "I" | "M" | "U" {
  if (ignored) {
    return "I";
  }
  return change === "added" || change === "untracked" ? "U" : "M";
}

/**
 * Resolves the accessible label for a file change or ignored node.
 *
 * @param change - The file change status, or undefined when unknown.
 * @param ignored - Whether the item is ignored.
 * @returns The Japanese status label.
 */
function getChangeLabel(
  change: FileChangeStatus | null | undefined,
  ignored: boolean,
): string {
  if (ignored) {
    return "無視";
  }
  return change === undefined || change === null
    ? "変更"
    : CHANGE_LABELS[change];
}
