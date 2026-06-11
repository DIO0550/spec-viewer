import type { SpecDocumentState } from "@/features/specs/hooks/useSpecs";

const KEY_SEPARATOR = "\u0000";
const MISSING_CORRELATION_SEGMENT = "no-correlation";

type IsReadableInput = Readonly<{
  status: SpecDocumentState["status"];
  currentKey: string | null;
  readableKey: string | null;
}>;

export const DocumentReadability = {
  /**
   * @param state - Current spec document state
   * @returns A stable identity for the document load that must become readable.
   */
  createKey(state: SpecDocumentState): string | null {
    if (state.status !== "ready") {
      return null;
    }

    return [
      state.workspacePath,
      state.specId,
      state.fileKey,
      state.correlationId ?? MISSING_CORRELATION_SEGMENT,
    ].join(KEY_SEPARATOR);
  },
  /**
   * @param input - Document status with the current and last readable keys
   * @returns True when the displayed document has become readable.
   */
  isReadable({ status, currentKey, readableKey }: IsReadableInput): boolean {
    if (status === "missing") {
      return true;
    }

    return currentKey !== null && readableKey === currentKey;
  },
} as const;
