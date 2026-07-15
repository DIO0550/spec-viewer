import { expect, test } from "vitest";

import { createSpecOperationRegistry } from "@/features/specs/application/specOperation";
import {
  createInitialSpecsState,
  reduceSpecsState,
} from "@/features/specs/application/specsState";
import type { SpecTree } from "@/features/specs/domain/specTree";
import * as TestValues from "@/shared/testing/validatedValueObjects";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const emptyTree: SpecTree = { specs: [] };

test("workspace切替後は古いtree completionを破棄する", () => {
  const registry = createSpecOperationRegistry();
  const workspaceOne = WorkspacePath.fromString("/workspace/one");
  const workspaceTwo = WorkspacePath.fromString("/workspace/two");
  registry.activateWorkspace(workspaceOne);
  const oldToken = registry.tryStart(workspaceOne)!;
  let state = reduceSpecsState(createInitialSpecsState(), {
    type: "workspaceLoadStarted",
    workspacePath: workspaceOne,
    token: oldToken,
  });
  registry.activateWorkspace(workspaceTwo);
  const currentToken = registry.tryStart(workspaceTwo)!;
  state = reduceSpecsState(state, {
    type: "workspaceLoadStarted",
    workspacePath: workspaceTwo,
    token: currentToken,
  });

  state = reduceSpecsState(state, {
    type: "treeLoaded",
    workspacePath: workspaceOne,
    tree: emptyTree,
    token: oldToken,
  });

  expect(state.specTreeState.status).toBe("loading");
  expect(state.specTreeState.workspacePath).toBe(workspaceTwo);
  expect(state.activeOperationToken).toEqual(currentToken);
});

test("同じworkspaceへのABAでも古いcompletionを破棄する", () => {
  const registry = createSpecOperationRegistry();
  const workspaceOne = WorkspacePath.fromString("/workspace/one");
  const workspaceTwo = WorkspacePath.fromString("/workspace/two");
  registry.activateWorkspace(workspaceOne);
  const oldToken = registry.tryStart(workspaceOne)!;
  let state = reduceSpecsState(createInitialSpecsState(), {
    type: "workspaceLoadStarted",
    workspacePath: workspaceOne,
    token: oldToken,
  });
  registry.activateWorkspace(workspaceTwo);
  registry.activateWorkspace(workspaceOne);
  const currentToken = registry.tryStart(workspaceOne)!;
  state = reduceSpecsState(state, {
    type: "workspaceLoadStarted",
    workspacePath: workspaceOne,
    token: currentToken,
  });

  state = reduceSpecsState(state, {
    type: "operationFinished",
    token: oldToken,
  });

  expect(state.isLoading).toBe(true);
  expect(state.activeOperationToken).toEqual(currentToken);
});

test("workspace clearはselection・archive・operationを同期的にresetする", () => {
  const registry = createSpecOperationRegistry();
  const workspacePath = WorkspacePath.fromString("/workspace/one");
  registry.activateWorkspace(workspacePath);
  const token = registry.tryStart(workspacePath)!;
  let state = reduceSpecsState(createInitialSpecsState(), {
    type: "workspaceLoadStarted",
    workspacePath,
    token,
  });
  state = reduceSpecsState(state, {
    type: "archiveStarted",
    specId: TestValues.specId("phase-one"),
    token,
  });

  state = reduceSpecsState(state, { type: "workspaceCleared" });

  expect(state).toEqual(createInitialSpecsState());
});

test("完了後は同じworkspaceで次のoperationを開始できる", () => {
  const registry = createSpecOperationRegistry();
  const workspacePath = WorkspacePath.fromString("/workspace/one");
  registry.activateWorkspace(workspacePath);
  const first = registry.tryStart(workspacePath)!;
  let state = reduceSpecsState(createInitialSpecsState(), {
    type: "workspaceLoadStarted",
    workspacePath,
    token: first,
  });
  state = reduceSpecsState(state, {
    type: "operationFinished",
    token: first,
  });
  registry.finish(first);
  const second = registry.tryStart(workspacePath)!;

  state = reduceSpecsState(state, {
    type: "operationStarted",
    token: second,
  });

  expect(state.isLoading).toBe(true);
  expect(state.activeOperationToken).toEqual(second);
});
