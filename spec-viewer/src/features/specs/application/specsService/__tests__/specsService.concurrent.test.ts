import { expect, test, vi } from "vitest";

import type {
  SpecGateway,
  SpecGatewayResult,
} from "@/features/specs/application/ports/specGateway";
import { createSpecOperationRegistry } from "@/features/specs/application/specOperation";
import { createSpecsApplicationService } from "@/features/specs/application/specsService";
import {
  createInitialSpecsState,
  reduceSpecsState,
  type SpecsState,
} from "@/features/specs/application/specsState";
import type { SpecDocument } from "@/features/specs/domain/specDocument";
import type { SpecTree } from "@/features/specs/domain/specTree";
import * as TestValues from "@/shared/testing/validatedValueObjects";
import { WorkspacePath } from "@/shared/domain/workspacePath";

type Deferred<Value> = Readonly<{
  promise: Promise<Value>;
  resolve: (value: Value) => void;
}>;

const workspaceOne = WorkspacePath.fromString("/workspace/one");
const workspaceTwo = WorkspacePath.fromString("/workspace/two");
const firstSpecId = TestValues.specId("first-spec");
const secondSpecId = TestValues.specId("second-spec");
const firstTree: SpecTree = {
  specs: [
    {
      id: firstSpecId,
      label: "First",
      kind: "spec",
      capabilities: { reviewable: true, archiveable: true },
      files: [
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};
const secondTree: SpecTree = {
  specs: [
    {
      id: secondSpecId,
      label: "Second",
      kind: "spec",
      capabilities: { reviewable: true, archiveable: true },
      files: [
        {
          key: "design",
          label: "Design",
          fileName: "design.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};
const tasksDocument: SpecDocument = {
  kind: "markdown",
  key: "tasks",
  path: "/workspace/tasks.md",
  contents: "# Tasks",
  blocks: [],
};
const designDocument: SpecDocument = {
  kind: "markdown",
  key: "design",
  path: "/workspace/design.md",
  contents: "# Design",
  blocks: [],
};

function createDeferred<Value>(): Deferred<Value> {
  let resolveValue: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolve) => {
    resolveValue = resolve;
  });
  return { promise, resolve: resolveValue };
}

function success<Value>(value: Value): SpecGatewayResult<Value> {
  return { ok: true, value };
}

function createHarness(gateway: SpecGateway) {
  let state = createInitialSpecsState();
  const selectionChanges = vi.fn();
  const service = createSpecsApplicationService({
    gateway,
    operationRegistry: createSpecOperationRegistry(),
    dispatch: (event) => {
      state = reduceSpecsState(state, event);
    },
    onSelectionChange: selectionChanges,
  });

  return {
    service,
    selectionChanges,
    getState: (): SpecsState => state,
  };
}

test("serviceは同一tickの二重reloadをsingle-flightにする", async () => {
  const deferredTree = createDeferred<SpecGatewayResult<SpecTree>>();
  const gateway: SpecGateway = {
    listSpecs: vi
      .fn()
      .mockResolvedValueOnce(success(firstTree))
      .mockReturnValueOnce(deferredTree.promise),
    readSpecDocument: vi.fn().mockResolvedValue(success(tasksDocument)),
    archiveSpec: vi.fn().mockResolvedValue(success(undefined)),
  };
  const harness = createHarness(gateway);
  await harness.service.synchronizeWorkspace(workspaceOne);

  const firstReload = harness.service.reloadSpecs({
    workspacePath: workspaceOne,
    preferredSelection: harness.getState().selection,
  });
  const secondReload = harness.service.reloadSpecs({
    workspacePath: workspaceOne,
    preferredSelection: harness.getState().selection,
  });

  await expect(secondReload).resolves.toBe(false);
  deferredTree.resolve(success(firstTree));
  await expect(firstReload).resolves.toBe(true);
  expect(gateway.listSpecs).toHaveBeenCalledTimes(2);
});

test("serviceはworkspace ABA後の古いcompletionを破棄する", async () => {
  const oldWorkspaceResult = createDeferred<SpecGatewayResult<SpecTree>>();
  const middleWorkspaceResult = createDeferred<SpecGatewayResult<SpecTree>>();
  const currentWorkspaceResult = createDeferred<SpecGatewayResult<SpecTree>>();
  const gateway: SpecGateway = {
    listSpecs: vi
      .fn()
      .mockReturnValueOnce(oldWorkspaceResult.promise)
      .mockReturnValueOnce(middleWorkspaceResult.promise)
      .mockReturnValueOnce(currentWorkspaceResult.promise),
    readSpecDocument: vi
      .fn()
      .mockResolvedValueOnce(success(designDocument))
      .mockResolvedValue(success(tasksDocument)),
    archiveSpec: vi.fn().mockResolvedValue(success(undefined)),
  };
  const harness = createHarness(gateway);

  const staleLoad = harness.service.synchronizeWorkspace(workspaceOne);
  const middleLoad = harness.service.synchronizeWorkspace(workspaceTwo);
  const currentLoad = harness.service.synchronizeWorkspace(workspaceOne);
  currentWorkspaceResult.resolve(success(secondTree));
  await currentLoad;
  oldWorkspaceResult.resolve(success({ specs: [] }));
  middleWorkspaceResult.resolve(success(firstTree));
  await Promise.all([staleLoad, middleLoad]);

  expect(harness.getState().workspacePath).toBe(workspaceOne);
  expect(harness.getState().specTreeState.tree).toEqual(secondTree);
  expect(harness.getState().selection).toEqual({
    specId: secondSpecId,
    fileKey: "design",
  });
});

test("archive後に消えたselectionはSpecTree domain queryでfallbackする", async () => {
  const gateway: SpecGateway = {
    listSpecs: vi
      .fn()
      .mockResolvedValueOnce(success(firstTree))
      .mockResolvedValueOnce(success(secondTree)),
    readSpecDocument: vi
      .fn()
      .mockResolvedValueOnce(success(tasksDocument))
      .mockResolvedValueOnce(success(designDocument)),
    archiveSpec: vi.fn().mockResolvedValue(success(undefined)),
  };
  const harness = createHarness(gateway);
  await harness.service.synchronizeWorkspace(workspaceOne);

  const archived = await harness.service.archiveSpec({
    workspacePath: workspaceOne,
    specId: firstSpecId,
    preferredSelection: harness.getState().selection,
  });

  expect(archived).toBe(true);
  expect(harness.getState().selection).toEqual({
    specId: secondSpecId,
    fileKey: "design",
  });
  expect(harness.getState().documentState.status).toBe("ready");
});

test("workspace clearは進行中completionを無効化してidleへ戻す", async () => {
  const deferredTree = createDeferred<SpecGatewayResult<SpecTree>>();
  const gateway: SpecGateway = {
    listSpecs: vi.fn().mockReturnValue(deferredTree.promise),
    readSpecDocument: vi.fn().mockResolvedValue(success(tasksDocument)),
    archiveSpec: vi.fn().mockResolvedValue(success(undefined)),
  };
  const harness = createHarness(gateway);

  const staleLoad = harness.service.synchronizeWorkspace(workspaceOne);
  await harness.service.synchronizeWorkspace(null);
  deferredTree.resolve(success(firstTree));
  await staleLoad;

  expect(harness.getState()).toEqual(createInitialSpecsState());
});
