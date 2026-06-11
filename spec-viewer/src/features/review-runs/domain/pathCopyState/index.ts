export type PathCopyState =
  | Readonly<{
      status: "idle";
      message: null;
    }>
  | Readonly<{
      status: "success" | "error";
      message: string;
    }>;

const COPY_SUCCESS_MESSAGE = "フォルダパスをコピーしました。";
const COPY_FAILURE_MESSAGE = "フォルダパスをコピーできませんでした。";

export const PathCopyState = {
  /** @returns The idle copy feedback state. */
  idle(): PathCopyState {
    return {
      status: "idle",
      message: null,
    };
  },
  /** @returns The success copy feedback state with its user message. */
  succeeded(): PathCopyState {
    return {
      status: "success",
      message: COPY_SUCCESS_MESSAGE,
    };
  },
  /**
   * @param error - Unknown clipboard failure
   * @returns The error copy feedback state with a readable user message.
   */
  failed(error: unknown): PathCopyState {
    return {
      status: "error",
      message: error instanceof Error ? error.message : COPY_FAILURE_MESSAGE,
    };
  },
} as const;
