import type {
  SpecGateway,
  SpecGatewayResult,
} from "@/features/specs/application/ports/specGateway";
import type { SpecTree } from "@/features/specs/domain/specTree";
import type { WorkspacePath } from "@/shared/domain/workspacePath";

export type ListSpecsInput = Readonly<{ workspacePath: WorkspacePath }>;

/**
 * @param gateway - Injected spec persistence boundary.
 * @param input - Validated workspace input.
 * @returns The listed tree or a mapped feature error.
 */
export async function listSpecs(
  gateway: SpecGateway,
  input: ListSpecsInput,
): Promise<SpecGatewayResult<SpecTree>> {
  return await gateway.listSpecs(input.workspacePath);
}
