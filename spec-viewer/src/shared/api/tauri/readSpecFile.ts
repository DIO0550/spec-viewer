import type {
  ReadSpecFileRequest,
  SpecDocument,
} from "@/features/specs/types/spec";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Markdown contents or missing-file metadata for a spec file. */
export async function readSpecFile(
  request: ReadSpecFileRequest,
): Promise<SpecDocument> {
  return invokeTauriCommand("read_spec_file", request);
}
