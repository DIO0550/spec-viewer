import type {
  ArchiveSpecRequest,
  ArchiveSpecResponse,
} from "@/features/specs/types/spec";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Metadata for the spec directory moved into the workspace archive. */
export async function archiveSpec(
  request: ArchiveSpecRequest,
): Promise<ArchiveSpecResponse> {
  return invokeTauriCommand("archive_spec", request);
}
