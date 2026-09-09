import type { WorktreeId } from "@/features/workspace/domain/worktree";
import type { ViewMode } from "@/features/workspace/types/viewMode";
import type { Brand } from "@/types/utilityTypes";

export type NavigationHistoryKey = Brand<string, "NavigationHistoryKey">;

export type NavigationHistoryKeyInput = Readonly<{
  workspaceId: string;
  worktreeId: WorktreeId;
  mode: ViewMode;
}>;

export const NavigationHistoryKey = {
  /**
   * @param input - Workspace, worktree and view mode identifying the history.
   * @returns The legacy JSON tuple with a navigation history brand.
   */
  create(input: NavigationHistoryKeyInput): NavigationHistoryKey {
    return JSON.stringify([
      input.workspaceId,
      input.worktreeId,
      input.mode,
    ]) as NavigationHistoryKey;
  },
};

export type NavigationHistory<Value> = Readonly<
  Partial<Record<NavigationHistoryKey, Value>>
>;

export const NavigationHistory = {
  /** @returns A fresh empty history. */
  empty<Value>(): NavigationHistory<Value> {
    return {};
  },
  /**
   * @param history - History to read without changing it.
   * @param key - Identity of the saved entry.
   * @returns The saved value, or undefined if unregistered.
   */
  get<Value>(
    history: NavigationHistory<Value>,
    key: NavigationHistoryKey,
  ): Value | undefined {
    return history[key];
  },
  /**
   * @param history - Previous history to preserve.
   * @param key - Identity to update.
   * @param value - Value matching the history's entry type.
   * @returns A new history with only the target key replaced.
   */
  set<Value>(
    history: NavigationHistory<Value>,
    key: NavigationHistoryKey,
    value: NoInfer<Value>,
  ): NavigationHistory<Value> {
    // Preserve selection history updates even for equal values; callers decide no-ops.
    return { ...history, [key]: value };
  },
};
