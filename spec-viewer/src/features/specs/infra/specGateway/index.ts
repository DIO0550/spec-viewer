import type { SpecCommands } from "@/features/specs/application/ports/specCommands";
import type {
  SpecGateway,
  SpecGatewayResult,
} from "@/features/specs/application/ports/specGateway";
import type { SpecFeatureError } from "@/features/specs/application/specError";
import { toSpecFeatureError } from "@/features/specs/infra/tauri/specErrorMapper";
import { WorkspacePath } from "@/shared/domain/workspacePath";

/**
 * @param commands - Concrete Tauri spec command adapter.
 * @returns A typed application gateway that owns DTO conversion and error mapping.
 */
export function createSpecGateway(commands: SpecCommands): SpecGateway {
  return {
    listSpecs: async (workspacePath) => {
      try {
        const tree = await commands.listSpecs(
          WorkspacePath.toString(workspacePath),
        );
        return success(tree);
      } catch (error) {
        return failure(toSpecFeatureError("list", error));
      }
    },
    readSpecDocument: async (input) => {
      try {
        const document = await commands.readSpecFile({
          workspacePath: WorkspacePath.toString(input.workspacePath),
          specId: input.specId,
          fileKey: input.fileKey,
          correlationId: input.correlationId,
        });
        return success(document);
      } catch (error) {
        return failure(toSpecFeatureError("read", error));
      }
    },
    archiveSpec: async (input) => {
      try {
        await commands.archiveSpec({
          workspacePath: WorkspacePath.toString(input.workspacePath),
          specId: input.specId,
        });
        return success(undefined);
      } catch (error) {
        return failure(toSpecFeatureError("archive", error));
      }
    },
  };
}

/**
 * @param value - Successful gateway value.
 * @returns A typed success result.
 */
function success<Value>(value: Value): SpecGatewayResult<Value> {
  return { ok: true, value };
}

/**
 * @param error - Mapped feature error.
 * @returns A typed failure result.
 */
function failure(error: SpecFeatureError): SpecGatewayResult<never> {
  return { ok: false, error };
}
