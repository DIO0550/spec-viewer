import type {
  ReadSpecDocumentInput,
  SpecGateway,
  SpecGatewayResult,
} from "@/features/specs/application/ports/specGateway";
import type { SpecDocument } from "@/features/specs/domain/specDocument";

/**
 * @param gateway - Injected spec persistence boundary.
 * @param input - Validated document identity and correlation input.
 * @returns The document or a mapped feature error.
 */
export async function readSpecDocument(
  gateway: SpecGateway,
  input: ReadSpecDocumentInput,
): Promise<SpecGatewayResult<SpecDocument>> {
  return await gateway.readSpecDocument(input);
}
