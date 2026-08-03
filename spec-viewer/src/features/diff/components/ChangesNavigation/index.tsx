import type { ReactElement } from "react";

import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";

export type ChangesNavigationItem = Readonly<{
  id: string;
  path: string;
  change?: FileChangeStatus;
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
  onSelect: (id: string) => void;
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
            aria-label={getChangeLabel(item.change)}
          >
            {getChangeToken(item.change)}
          </span>
          <span className="changes-navigation__path">{item.path}</span>
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

function getChangeToken(change: FileChangeStatus | undefined): "M" | "U" {
  return change === "added" || change === "untracked" ? "U" : "M";
}

function getChangeLabel(change: FileChangeStatus | undefined): string {
  return change === undefined ? "変更" : CHANGE_LABELS[change];
}
