import type { ReactElement } from "react";

import type { WorkspaceWorktreesUnavailableReason } from "@/features/workspace/types/workspaceWorktreesLoadState";

export type ChangesNavigationItem = Readonly<{ id: string; path: string }>;
export type ChangesNavigationAvailability =
  | Readonly<{ status: "ready" }>
  | Readonly<{
      status: "unavailable";
      reason: WorkspaceWorktreesUnavailableReason;
    }>;
export type ChangesNavigationProps = Readonly<{
  items: readonly ChangesNavigationItem[];
  selectedId: string | null;
  availability: ChangesNavigationAvailability;
  onSelect: (id: string) => void;
}>;

/**
 * Displays controlled changed-file navigation or a recoverable data state.
 *
 * @param props - Availability, files, selection and selection callback.
 * @returns Changes navigation for the mode-navigation slot.
 */
export function ChangesNavigation(props: ChangesNavigationProps): ReactElement {
  const { items, selectedId, availability, onSelect } = props;

  if (availability.status === "unavailable") {
    return (
      <ChangesStatus>
        {availability.reason === "contract-pending"
          ? "Changesの契約を確認中です。Specsモードで仕様の確認を続けられます。"
          : "変更ファイル一覧はまだ利用できません。Specsモードで仕様の確認を続けられます。"}
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
          {item.path}
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
