declare const workspacePathBrand: unique symbol;

export type WorkspacePath = string & {
  readonly [workspacePathBrand]: true;
};

export const WorkspacePath = {
  /**
   * @param value - Raw workspace path string from the UI boundary.
   * @returns Branded workspace path for feature/domain use.
   */
  fromString(value: string): WorkspacePath {
    return value as WorkspacePath;
  },

  /**
   * @param value - Branded workspace path.
   * @returns Raw string for IPC and filesystem boundaries.
   */
  toString(value: WorkspacePath): string {
    return value;
  },
};
