import type { ReactElement, ReactNode } from "react";

import type { WorkspaceWorktreesUnavailableReason } from "@/features/workspace/types/workspaceWorktreesLoadState";

export type DiffWorkspaceAvailability =
  | Readonly<{ status: "ready" }>
  | Readonly<{
      status: "unavailable";
      reason: WorkspaceWorktreesUnavailableReason;
    }>;
export type DiffWorkspaceProps = Readonly<{
  selectedPath: string | null;
  preview: ReactNode;
  availability: DiffWorkspaceAvailability;
}>;

/**
 * Displays only the controlled central Diff preview.
 *
 * @param props - Availability, selected path and caller-owned preview.
 * @returns Diff preview or a recoverable status.
 */
export function DiffWorkspace(props: DiffWorkspaceProps): ReactElement {
  const { selectedPath, preview, availability } = props;

  if (availability.status === "unavailable") {
    return (
      <DiffStatus>
        {availability.reason === "contract-pending"
          ? "Diff表示の契約を確認中です。Specsモードで仕様の確認を続けられます。"
          : "Diffデータはまだ利用できません。Specsモードで仕様の確認を続けられます。"}
      </DiffStatus>
    );
  }

  if (selectedPath === null) {
    return <DiffStatus>表示する変更ファイルを選択してください。</DiffStatus>;
  }

  return (
    <section className="diff-preview" aria-label={`${selectedPath} の差分`}>
      {preview}
    </section>
  );
}

/**
 * @param props - Status text.
 * @returns An announced Diff state.
 */
function DiffStatus(props: Readonly<{ children: string }>): ReactElement {
  return (
    <p
      className="diff-workspace__status"
      role="status"
      aria-live="polite"
      aria-label="Diffデータ状態"
    >
      {props.children}
    </p>
  );
}
