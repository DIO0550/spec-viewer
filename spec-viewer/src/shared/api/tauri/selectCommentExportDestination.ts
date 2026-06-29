import { save, type SaveDialogOptions } from "@tauri-apps/plugin-dialog";

import type { ExportCommentsTarget } from "@/features/comments/types/comment";

const COMMENT_EXPORT_DEFAULT_SPEC_ID = "spec";
const INVALID_PATH_CHARS_PATTERN = /[^A-Za-z0-9._-]+/g;

/** @returns A destination path for the requested comment export, or null. */
export async function selectCommentExportDestination(
  target: ExportCommentsTarget,
): Promise<string | null> {
  const options = createCommentExportDialogOptions(target);

  return save(options);
}

/** @returns Native save dialog options for the requested comment export target. */
function createCommentExportDialogOptions(
  target: ExportCommentsTarget,
): SaveDialogOptions {
  const fileName = createCommentExportDefaultFileName(target);
  const isJsonExport = target.scope === "workspace";

  return {
    title: "Export comments",
    defaultPath: fileName,
    filters: [
      {
        name: isJsonExport ? "JSON" : "Markdown",
        extensions: [isJsonExport ? "json" : "md"],
      },
    ],
  };
}

/** @returns A safe default file name for a comment export. */
function createCommentExportDefaultFileName(
  target: ExportCommentsTarget,
): string {
  if (target.scope === "workspace") {
    return "workspace-comments.json";
  }

  const specId = sanitizeExportPathPart(target.specId);

  if (target.scope === "spec") {
    return `${specId}-comments.md`;
  }

  return `${specId}-${target.fileKey}-comments.md`;
}

/** @returns A file-system-safe path component for save dialog defaults. */
function sanitizeExportPathPart(value: string): string {
  const sanitized = value.trim().replace(INVALID_PATH_CHARS_PATTERN, "-");

  if (sanitized.length === 0) {
    return COMMENT_EXPORT_DEFAULT_SPEC_ID;
  }

  return sanitized;
}
