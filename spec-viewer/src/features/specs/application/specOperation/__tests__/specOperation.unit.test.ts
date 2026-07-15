import { expect, test } from "vitest";

import { createSpecOperationRegistry } from "@/features/specs/application/specOperation";
import { WorkspacePath } from "@/shared/domain/workspacePath";

test("同一tickでは2つ目のoperationを開始しない", () => {
  const registry = createSpecOperationRegistry();
  const workspacePath = WorkspacePath.fromString("/workspace/one");
  registry.activateWorkspace(workspacePath);

  const first = registry.tryStart(workspacePath);
  const second = registry.tryStart(workspacePath);

  expect(first).not.toBeNull();
  expect(second).toBeNull();
});

test("同じworkspaceへ戻っても以前のtokenをcurrentと判定しない", () => {
  const registry = createSpecOperationRegistry();
  const workspaceOne = WorkspacePath.fromString("/workspace/one");
  const workspaceTwo = WorkspacePath.fromString("/workspace/two");
  registry.activateWorkspace(workspaceOne);
  const stale = registry.tryStart(workspaceOne);

  registry.activateWorkspace(workspaceTwo);
  registry.activateWorkspace(workspaceOne);
  const current = registry.tryStart(workspaceOne);

  expect(stale).not.toBeNull();
  expect(current).not.toBeNull();
  expect(registry.isCurrent(stale!)).toBe(false);
  expect(registry.isCurrent(current!)).toBe(true);
});

test("stale tokenのfinishはcurrent operationを解放しない", () => {
  const registry = createSpecOperationRegistry();
  const workspaceOne = WorkspacePath.fromString("/workspace/one");
  const workspaceTwo = WorkspacePath.fromString("/workspace/two");
  registry.activateWorkspace(workspaceOne);
  const stale = registry.tryStart(workspaceOne)!;
  registry.activateWorkspace(workspaceTwo);
  const current = registry.tryStart(workspaceTwo)!;

  registry.finish(stale);

  expect(registry.isCurrent(current)).toBe(true);
  expect(registry.tryStart(workspaceTwo)).toBeNull();
});
