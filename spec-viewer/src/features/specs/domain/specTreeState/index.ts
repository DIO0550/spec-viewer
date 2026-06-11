import type { SpecTree } from "@/features/specs/types/spec";
import type { NormalizedCommandError } from "@/shared/types/ipc";

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
      tree: SpecTree;
      error: null;
    }>
  | Readonly<{
      status: "empty";
      workspacePath: string;
      tree: SpecTree;
      error: null;
    }>
  | Readonly<{
      status: "error";
      workspacePath: string;
      tree: null;
      error: NormalizedCommandError;
    }>;

export const SpecTreeState = {
  /** @returns The idle spec tree state used before a workspace is selected. */
  idle(): SpecTreeState {
    return {
      status: "idle",
      workspacePath: null,
      tree: null,
      error: null,
    };
  },
  /**
   * @param workspacePath - Workspace being scanned
   * @returns The loading spec tree state for a workspace scan in flight.
   */
  loading(workspacePath: string): SpecTreeState {
    return {
      status: "loading",
      workspacePath,
      tree: null,
      error: null,
    };
  },
  /**
   * @param input - Scanned workspace and resulting spec tree
   * @returns The ready state, or the empty state when no specs were found.
   */
  fromTree({
    workspacePath,
    tree,
  }: Readonly<{ workspacePath: string; tree: SpecTree }>): SpecTreeState {
    return {
      status: tree.specs.length === 0 ? "empty" : "ready",
      workspacePath,
      tree,
      error: null,
    };
  },
  /**
   * @param input - Scanned workspace and normalized scan failure
   * @returns The error spec tree state for a failed workspace scan.
   */
  failed({
    workspacePath,
    error,
  }: Readonly<{
    workspacePath: string;
    error: NormalizedCommandError;
  }>): SpecTreeState {
    return {
      status: "error",
      workspacePath,
      tree: null,
      error,
    };
  },
} as const;
