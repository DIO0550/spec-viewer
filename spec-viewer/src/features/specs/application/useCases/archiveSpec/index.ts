import type {
  ArchiveSpecInput,
  SpecGateway,
  SpecGatewayResult,
} from "@/features/specs/application/ports/specGateway";

/**
 * @param gateway - Injected spec persistence boundary.
 * @param input - Validated spec identity to archive.
 * @returns Success or a mapped feature error.
 */
export async function archiveSpec(
  gateway: SpecGateway,
  input: ArchiveSpecInput,
): Promise<SpecGatewayResult<void>> {
  return await gateway.archiveSpec(input);
}
