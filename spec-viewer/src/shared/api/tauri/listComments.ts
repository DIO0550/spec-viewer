import type {
  ListCommentsRequest,
  ListCommentsResponse,
} from "@/features/comments/types/comment";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Comment threads for the requested spec file and status filter. */
export async function listComments(
  request: ListCommentsRequest,
): Promise<ListCommentsResponse> {
  return invokeTauriCommand("list_comments", request);
}
