import { SpecFeatureError } from "@/features/specs/domain/specError";
import * as specGateway from "@/features/specs/infra/specGateway";
import type { SpecDocument, SpecFileScope } from "@/features/specs/types/spec";
import { specCommands } from "@/lib/api/tauri";
import { ReadSpecFileCommandError } from "@/lib/api/tauri/readSpecFile";
import { startPerformanceSpan } from "@/lib/performance";

export type ReadDocumentInput = Readonly<{
  target: SpecFileScope;
  correlationId: string;
}>;

export type ReadDocumentResult = Readonly<
  | {
      status: "success";
      document: SpecDocument;
      correlationId: string;
    }
  | {
      status: "error";
      error: ReturnType<typeof SpecFeatureError.fromCommandError>;
      correlationId: string;
    }
>;

/**
 * Reads one spec document and normalizes the command boundary result.
 * @param input - Document scope and correlation id for the read operation.
 * @returns A successful document result or a normalized feature error.
 */
export async function readDocument(
  input: ReadDocumentInput,
): Promise<ReadDocumentResult> {
  const { correlationId, target } = input;
  const endSpan = startPerformanceSpan(correlationId, "document.read", {
    specId: target.specId,
    fileKey: target.fileKey,
  });

  try {
    const document = await specGateway.readSpecFile(
      specCommands,
      specGateway.createReadSpecFileRequest({
        ...target,
        correlationId,
      }),
    );
    endSpan({
      bytes: document.contents?.length ?? 0,
      blockCount: document.blocks.length,
      missing: document.missing,
    });

    return {
      status: "success",
      document,
      correlationId,
    };
  } catch (error) {
    endSpan({ error: true });

    return {
      status: "error",
      error: SpecFeatureError.fromCommandError(
        ReadSpecFileCommandError.fromUnknown(error),
      ),
      correlationId,
    };
  }
}
