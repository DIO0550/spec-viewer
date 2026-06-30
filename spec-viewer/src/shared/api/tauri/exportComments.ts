import type {
  ExportCommentsRequest,
  ExportCommentsResponse,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Metadata for the comment export written by the backend. */
export async function exportComments(
  request: ExportCommentsRequest,
): Promise<ExportCommentsResponse> {
  return invokeTauriCommand("export_comments", request);
}
