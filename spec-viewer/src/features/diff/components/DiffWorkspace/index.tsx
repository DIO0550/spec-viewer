import type { ReactElement, ReactNode } from "react";

import type { WorkspaceWorktreesUnavailableReason } from "@/features/workspace/types/workspaceWorktreesLoadState";

export type DiffWorkspaceAvailability =
  | Readonly<{ status: "ready" }>
  | Readonly<{
      status: "unavailable";
      reason: WorkspaceWorktreesUnavailableReason;
    }>;
export type DiffWorkspaceState =
  | Readonly<{ status: "noSelection"; label?: string }>
  | Readonly<{ status: "unchanged" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{
      status: "selectionRequired";
      message: string;
      onRetry: () => void;
    }>
  | Readonly<{ status: "failed"; message: string; onRetry: () => void }>
  | Readonly<{ status: "ready"; selectedPath: string; preview: ReactNode }>;

export type DiffWorkspaceProps = Readonly<{
  state?: DiffWorkspaceState;
  selectedPath: string | null;
  preview: ReactNode;
  availability: DiffWorkspaceAvailability;
  revisionSelector?: ReactNode;
  fileTabs?: ReactNode;
}>;

/**
 * Displays only the controlled central Diff preview.
 *
 * @param props - Availability, selected path and caller-owned preview.
 * @returns Diff preview or a recoverable status.
 */
export function DiffWorkspace(props: DiffWorkspaceProps): ReactElement {
  const {
    state,
    selectedPath,
    preview,
    availability,
    revisionSelector,
    fileTabs,
  } = props;

  if (state !== undefined) {
    return (
      <div className="diff-workspace">
        {revisionSelector}
        {fileTabs}
        <div className="diff-workspace__content">
          {renderDiffWorkspaceState(state)}
        </div>
      </div>
    );
  }

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
function DiffStatus(props: Readonly<{ children: ReactNode }>): ReactElement {
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

/**
 * Renders the controlled Diff preview state (empty selection, unchanged
 * file, loading, failed, or ready).
 *
 * @param state - The controlled Diff workspace state to render.
 * @returns The status message, error with retry, or the ready preview.
 */
function renderDiffWorkspaceState(state: DiffWorkspaceState): ReactElement {
  if (state.status === "noSelection") {
    const label = state.label ?? "Specファイル";
    return <DiffStatus>表示する{label}を選択してください。</DiffStatus>;
  }
  if (state.status === "unchanged") {
    return <DiffStatus>選択中のファイルに変更はありません。</DiffStatus>;
  }
  if (state.status === "loading") {
    return <DiffStatus>差分を読み込んでいます。</DiffStatus>;
  }
  if (state.status === "selectionRequired") {
    return (
      <div className="diff-workspace__error" role="status">
        <p>{state.message}</p>
        <button type="button" onClick={state.onRetry}>
          再試行
        </button>
      </div>
    );
  }
  if (state.status === "failed") {
    return (
      <div className="diff-workspace__error" role="alert" aria-live="polite">
        <p>{state.message}</p>
        <button type="button" onClick={state.onRetry}>
          再試行
        </button>
      </div>
    );
  }

  return (
    <section
      className="diff-preview"
      aria-label={state.selectedPath + " の差分"}
    >
      {state.preview}
    </section>
  );
}
