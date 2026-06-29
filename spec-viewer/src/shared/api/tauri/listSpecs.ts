import type { SpecTree } from "@/features/specs/types/spec";

import { invokeTauriCommand } from "./invokeTauriCommand";

/** @returns Spec tree for the workspace path. */
export async function listSpecs(workspacePath: string): Promise<SpecTree> {
  return invokeTauriCommand("list_specs", { workspacePath });
}
