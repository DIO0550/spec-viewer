import {
  SpecTree,
  type SpecTree as SpecTreeType,
} from "@/features/specs/domain/specTree";
import type { SpecFeatureError } from "@/features/specs/domain/specError";

export type SpecTreeState =
  | Readonly<{
      status: "idle";
      workspacePath: null;
      tree: null;
      error: null;
    }>
  | Readonly<{
      status: "loading";
      workspacePath: string;
      tree: null;
      error: null;
    }>
  | Readonly<{
      status: "ready";
      workspacePath: string;
      tree: SpecTreeType;
      error: null;
    }>
  | Readonly<{
      status: "empty";
      workspacePath: string;
      tree: SpecTreeType;
      error: null;
    }>
  | Readonly<{
      status: "error";
      workspacePath: string;
      tree: null;
      error: SpecFeatureError;
    }>;

export const SpecTreeState = {
  /** @returns Idle spec tree state for no selected workspace. */
  idle: (): SpecTreeState => ({
    status: "idle",
    workspacePath: null,
    tree: null,
    error: null,
  }),

  /**
   * @param workspacePath - Active workspace path
   * @returns Loading state for the workspace.
   */
  loading: (workspacePath: string): SpecTreeState => ({
    status: "loading",
    workspacePath,
    tree: null,
    error: null,
  }),

  /**
   * @param workspacePath - Active workspace path
   * @param tree - Loaded spec tree
   * @returns Ready or empty state based on the tree contents.
   */
  loaded: (workspacePath: string, tree: SpecTreeType): SpecTreeState => {
    if (SpecTree.isEmpty(tree)) {
      return {
        status: "empty",
        workspacePath,
        tree,
        error: null,
      };
    }

    return {
      status: "ready",
      workspacePath,
      tree,
      error: null,
    };
  },

  /**
   * @param workspacePath - Active workspace path
   * @param error - Feature-level spec error
   * @returns Error state for a failed tree load.
   */
  failed: (workspacePath: string, error: SpecFeatureError): SpecTreeState => ({
    status: "error",
    workspacePath,
    tree: null,
    error,
  }),
} as const;
