import { useCallback, useRef, useState } from "react";
import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import type {
  ReadSpecFileRequest,
  SpecDocument,
  SpecFileKey,
} from "@/features/specs/types/spec";
import { normalizeCommandError } from "@/shared/api/tauri";
import {
  createPerformanceCorrelationId,
  startPerformanceSpan,
} from "@/shared/lib/performance";

type ReadSpecFileCommand = (
  request: ReadSpecFileRequest,
) => Promise<SpecDocument>;

type UseSpecDocumentLoaderOptions = Readonly<{
  workspacePath: string | null;
  readSpecFile: ReadSpecFileCommand;
}>;

export type UseSpecDocumentLoaderResult = Readonly<{
  documentState: SpecDocumentState;
  /**
   * Invalidates in-flight reads and moves the document state to idle.
   *
   * @param workspacePath - Active workspace path, or null
   * @param specId - Selected spec id, or null
   * @param fileKey - Selected file key, or null
   */
  setIdleDocumentState: (
    workspacePath: string | null,
    specId?: string | null,
    fileKey?: SpecFileKey | null,
  ) => void;
  /**
   * Loads one spec file with stale-response protection.
   *
   * @param specId - Spec owning the file
   * @param fileKey - File to read
   */
  loadDocument: (specId: string, fileKey: SpecFileKey) => Promise<boolean>;
}>;

/**
 * @param options - Active workspace path and the spec file read command.
 * @returns Markdown document state and latest-wins document loading operations.
 */
export function useSpecDocumentLoader({
  workspacePath,
  readSpecFile,
}: UseSpecDocumentLoaderOptions): UseSpecDocumentLoaderResult {
  const documentRequestIdRef = useRef(0);
  const [documentState, setDocumentState] = useState<SpecDocumentState>(() =>
    SpecDocumentState.idle(null),
  );

  const setIdleDocumentState = useCallback(
    (
      activeWorkspacePath: string | null,
      specId: string | null = null,
      fileKey: SpecFileKey | null = null,
    ): void => {
      documentRequestIdRef.current += 1;
      setDocumentState(
        SpecDocumentState.idle(activeWorkspacePath, specId, fileKey),
      );
    },
    [],
  );

  const loadDocument = useCallback(
    async (specId: string, fileKey: SpecFileKey): Promise<boolean> => {
      if (workspacePath === null) {
        setIdleDocumentState(workspacePath, specId, fileKey);
        return true;
      }

      const context = {
        workspacePath,
        specId,
        fileKey,
        correlationId: createPerformanceCorrelationId("document-read"),
      };
      const requestId = documentRequestIdRef.current + 1;
      documentRequestIdRef.current = requestId;
      setDocumentState(SpecDocumentState.loading(context));

      const endSpan = startPerformanceSpan(
        context.correlationId,
        "document.read",
        { specId, fileKey },
      );

      try {
        const document = await readSpecFile(context);
        endSpan({
          bytes: document.contents?.length ?? 0,
          blockCount: document.blocks.length,
          missing: document.missing,
        });

        if (documentRequestIdRef.current !== requestId) {
          return false;
        }

        setDocumentState(
          SpecDocumentState.fromDocument({ ...context, document }),
        );
        return true;
      } catch (error) {
        endSpan({
          error: true,
        });

        if (documentRequestIdRef.current !== requestId) {
          return false;
        }

        setDocumentState(
          SpecDocumentState.failed({
            ...context,
            error: normalizeCommandError(error),
          }),
        );
        return false;
      }
    },
    [readSpecFile, setIdleDocumentState, workspacePath],
  );

  return { documentState, setIdleDocumentState, loadDocument };
}
