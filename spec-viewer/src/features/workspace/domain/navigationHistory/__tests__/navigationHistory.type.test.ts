import { expectTypeOf, test } from "vitest";

import {
  NavigationHistory,
  NavigationHistoryKey,
  type NavigationHistoryKeyInput,
} from "@/features/workspace/domain/navigationHistory";
import type {
  RepositoryDiffNavigationAction,
  RepositoryDiffNavigationEntry,
  RepositoryDiffNavigationState,
} from "@/features/repositoryDiff/domain/repositoryDiffNavigationState";
import type { UseRepositoryDiffNavigationStateResult } from "@/features/repositoryDiff/hooks/useRepositoryDiffNavigationState";
import type { WorkspaceNavigationState } from "@/features/workspace/types/workspaceNavigationState";
import type { Brand } from "@/types/utilityTypes";

test("生成値は専用キー型で文字列として利用できる", () => {
  const key = NavigationHistoryKey.create({
    workspaceId: "/ws",
    worktreeId: "main",
    mode: "specs",
  });
  expectTypeOf(key).toEqualTypeOf<NavigationHistoryKey>();
  expectTypeOf<NavigationHistoryKey>().toExtend<string>();
});

test("素の文字列と別ブランドは履歴キーにならない", () => {
  expectTypeOf<string>().not.toExtend<NavigationHistoryKey>();
  expectTypeOf<
    Brand<string, "OtherKey">
  >().not.toExtend<NavigationHistoryKey>();
});

test("キー生成には3要素が必要で不正なmodeやIDを拒否する", () => {
  expectTypeOf<
    Omit<NavigationHistoryKeyInput, "workspaceId">
  >().not.toExtend<NavigationHistoryKeyInput>();
  expectTypeOf<
    Omit<NavigationHistoryKeyInput, "worktreeId">
  >().not.toExtend<NavigationHistoryKeyInput>();
  expectTypeOf<
    Omit<NavigationHistoryKeyInput, "mode">
  >().not.toExtend<NavigationHistoryKeyInput>();
  expectTypeOf<{
    workspaceId: null;
    worktreeId: string;
    mode: "specs";
  }>().not.toExtend<NavigationHistoryKeyInput>();
  expectTypeOf<{
    workspaceId: string;
    worktreeId: null;
    mode: "specs";
  }>().not.toExtend<NavigationHistoryKeyInput>();
  expectTypeOf<{
    workspaceId: number;
    worktreeId: number;
    mode: "specs";
  }>().not.toExtend<NavigationHistoryKeyInput>();
  expectTypeOf<{
    workspaceId: string;
    worktreeId: string;
    mode: "other";
  }>().not.toExtend<NavigationHistoryKeyInput>();
});

test("履歴操作は値の型を保持し未登録も読取型に含める", () => {
  const key = NavigationHistoryKey.create({
    workspaceId: "/ws",
    worktreeId: "main",
    mode: "specs",
  });
  const history = NavigationHistory.empty<string | null>();
  const next = NavigationHistory.set(history, key, "spec-1");
  const cleared = NavigationHistory.set(history, key, null);
  expectTypeOf(next).toEqualTypeOf<NavigationHistory<string | null>>();
  expectTypeOf(cleared).toEqualTypeOf<NavigationHistory<string | null>>();
  expectTypeOf(NavigationHistory.get(next, key)).toEqualTypeOf<
    string | null | undefined
  >();
});

/** @param key - A valid key used to check rejected inferred calls without executing them. */
function checkRejectedHistoryValues(key: NavigationHistoryKey): void {
  const history = NavigationHistory.empty<string | null>();
  // @ts-expect-error Values cannot widen a string/null history to accept numbers.
  NavigationHistory.set(history, key, 123);
  // @ts-expect-error Undefined represents an unregistered entry, not a saved selection.
  NavigationHistory.set(history, key, undefined);
}
void checkRejectedHistoryValues;

test("全actionとhookの返却値までキー型を維持する", () => {
  expectTypeOf<
    RepositoryDiffNavigationAction["key"]
  >().toEqualTypeOf<NavigationHistoryKey>();
  expectTypeOf<
    UseRepositoryDiffNavigationStateResult["key"]
  >().toEqualTypeOf<NavigationHistoryKey | null>();
});

test("両履歴のキー制約と未登録の型を公開境界まで維持する", () => {
  type SelectionHistory =
    WorkspaceNavigationState["selectedItemIdBySelectionKey"];
  type DiffHistory = RepositoryDiffNavigationState["entriesByKey"];
  expectTypeOf<SelectionHistory[NavigationHistoryKey]>().toEqualTypeOf<
    string | null | undefined
  >();
  expectTypeOf<DiffHistory[NavigationHistoryKey]>().toEqualTypeOf<
    RepositoryDiffNavigationEntry | undefined
  >();
  expectTypeOf<string>().not.toExtend<keyof SelectionHistory>();
  expectTypeOf<string>().not.toExtend<keyof DiffHistory>();
});

/** @param key - A valid key for compile-time misuse checks, never executed. */
function checkRejectedDiffValues(key: NavigationHistoryKey): void {
  const history = NavigationHistory.empty<RepositoryDiffNavigationEntry>();
  // @ts-expect-error A Diff entry cannot be replaced by a selection ID.
  NavigationHistory.set(history, key, "spec-1");
  const invalid: RepositoryDiffNavigationAction = {
    type: "pathOpened",
    // @ts-expect-error Actions require a generated navigation key.
    key: "main",
    path: "a.ts",
  };
  void invalid;
}
void checkRejectedDiffValues;
