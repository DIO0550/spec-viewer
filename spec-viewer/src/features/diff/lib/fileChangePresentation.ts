import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";

export type FileChangePresentation = Readonly<{
  token: string;
  label: string;
}>;

const Presentations = {
  added: { token: "A", label: "追加" },
  modified: { token: "M", label: "変更" },
  deleted: { token: "D", label: "削除" },
  renamed: { token: "R", label: "名前変更" },
  copied: { token: "C", label: "コピー" },
  typeChanged: { token: "T", label: "種別変更" },
  untracked: { token: "U", label: "未追跡" },
} as const satisfies Record<FileChangeStatus, FileChangePresentation>;

const UnchangedPresentation: FileChangePresentation = {
  token: "—",
  label: "変更なし",
};

/**
 * Resolves compact and accessible presentation for a file change.
 *
 * @param change - File status, or null for an unchanged path.
 * @returns Stable token and localized label.
 */
export function getFileChangePresentation(
  change: FileChangeStatus | null,
): FileChangePresentation {
  return change === null ? UnchangedPresentation : Presentations[change];
}
