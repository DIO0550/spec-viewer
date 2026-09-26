export type WorkspaceDropIntent =
  | Readonly<{ type: "enter" }>
  | Readonly<{ type: "leave" }>
  | Readonly<{ type: "drop"; paths: readonly string[] }>;

export const WorkspaceDropIntent = {
  /**
   * @param paths - Paths extracted from a browser drop.
   * @returns A source independent drop intent.
   */
  fromPaths(paths: readonly string[]): WorkspaceDropIntent {
    return { type: "drop", paths };
  },
} as const;
