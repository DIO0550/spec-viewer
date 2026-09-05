import type {
  OpenDroppedWorkspaceOutcome,
  OpenRecentWorkspaceOutcome,
  OpenWorkspaceFromInputOutcome,
  WorkspaceLoaderFlowIo,
  WorkspaceLoaderGuards,
  WorkspaceOpenOutcome,
} from "@/features/workspace/hooks/useWorkspaceLoader/types";
import { ValidateWorkspaceDirectoryCommandError } from "@/lib/api/tauri/validateWorkspaceDirectory";

const invalidDroppedDirectoryMessage =
  "ワークスペースフォルダをドロップしてください。ファイルはワークスペースとして開けません。";
const missingSavedWorkspaceMessage =
  "ワークスペースが見つかりません。保存済み一覧から削除しました。";
const unsupportedSavedWorkspaceMessage =
  "対応していないワークスペースです。保存済み一覧から削除しました。";

/**
 * 入口ガード規則（1箇所定義）。drop / recent は flow 内部で使い {skipped} を返す。
 * browse アダプタ（index.ts）はダイアログ表示より先にこの述語を再利用する。
 *
 * @param guards - Whether a workspace open or a browse dialog is currently in progress.
 * @returns True when a new entry must be a no-op.
 */
export function isEntryGuarded(guards: WorkspaceLoaderGuards): boolean {
  return guards.isWorkspaceOpening || guards.isBrowsingWorkspace;
}

/**
 * validate なしの共通コア（browse のダイアログ確定後・手入力が合流）。
 *
 * @param path - The confirmed workspace directory path.
 * @param io - The injected IPC wrappers.
 * @returns Loaded or silently-failed outcome.
 */
export async function openWorkspacePath(
  path: string,
  io: WorkspaceLoaderFlowIo,
): Promise<WorkspaceOpenOutcome> {
  const isLoaded = await io.load(path, false);

  return isLoaded ? { type: "loaded" } : { type: "loadFailedSilently" };
}

/**
 * パス手入力 + Enter: trim → 空なら emptyInput（io 未呼び出し）→ コアへ委譲（ガードなし）。
 *
 * @param rawInput - The raw workspace input value.
 * @param io - The injected IPC wrappers.
 * @returns Empty-input, loaded or silently-failed outcome.
 */
export async function openWorkspaceFromInput(
  rawInput: string,
  io: WorkspaceLoaderFlowIo,
): Promise<OpenWorkspaceFromInputOutcome> {
  const path = rawInput.trim();

  if (path.length === 0) {
    return { type: "emptyInput" };
  }

  return openWorkspacePath(path, io);
}

/**
 * フォルダ D&D: validate → load（preserve: true）。失敗は dropMessage を outcome で返す。
 *
 * @param path - The dropped directory path.
 * @param guards - The current open/browse guard values.
 * @param io - The injected IPC wrappers.
 * @returns Skipped, loaded, silently-failed, not-directory or exception outcome.
 */
export async function openDroppedWorkspacePath(
  path: string,
  guards: WorkspaceLoaderGuards,
  io: WorkspaceLoaderFlowIo,
): Promise<OpenDroppedWorkspaceOutcome> {
  if (isEntryGuarded(guards)) {
    return { type: "skipped" };
  }

  try {
    const validation = await io.validate(path);

    if (!validation.isDirectory) {
      return {
        type: "notDirectory",
        dropMessage: invalidDroppedDirectoryMessage,
      };
    }

    const isLoaded = await io.load(path, true);

    return isLoaded ? { type: "loaded" } : { type: "loadFailedSilently" };
  } catch (error) {
    return {
      type: "dropException",
      dropMessage:
        ValidateWorkspaceDirectoryCommandError.fromUnknown(error).message,
    };
  }
}

/**
 * 保存済み一覧クリック / startup restore: validate → load（preserve: true）。
 * 失敗3分岐はいずれも {removePath, dialogMessage, rollbackInput} を outcome で返す。
 *
 * @param path - The recent workspace path.
 * @param guards - The current open/browse guard values.
 * @param activeWorkspaceRoot - The active workspace root for rollback, or null.
 * @param io - The injected IPC wrappers.
 * @returns Skipped, loaded or one of the three recent-failure outcomes.
 */
export async function openRecentWorkspacePath(
  path: string,
  guards: WorkspaceLoaderGuards,
  activeWorkspaceRoot: string | null,
  io: WorkspaceLoaderFlowIo,
): Promise<OpenRecentWorkspaceOutcome> {
  if (isEntryGuarded(guards)) {
    return { type: "skipped" };
  }

  const rollbackInput = activeWorkspaceRoot ?? "";

  try {
    const validation = await io.validate(path);

    if (!validation.isDirectory) {
      return {
        type: "recentMissing",
        removePath: path,
        dialogMessage: missingSavedWorkspaceMessage,
        rollbackInput,
      };
    }

    const isLoaded = await io.load(path, true);

    if (!isLoaded) {
      return {
        type: "recentUnsupported",
        removePath: path,
        dialogMessage: unsupportedSavedWorkspaceMessage,
        rollbackInput,
      };
    }

    return { type: "loaded" };
  } catch (error) {
    return {
      type: "recentException",
      removePath: path,
      dialogMessage: `${missingSavedWorkspaceMessage} ${
        ValidateWorkspaceDirectoryCommandError.fromUnknown(error).message
      }`,
      rollbackInput,
    };
  }
}
