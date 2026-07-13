import * as TestValues from "@/shared/testing/validatedValueObjects";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  type SpecFileWatchSubscriber,
  type StartSpecFileWatchCommand,
  type StopSpecFileWatchCommand,
  useSpecFileWatcher,
} from "@/features/specs/hooks/useSpecFileWatcher";
import type {
  StartSpecFileWatchResponse,
  StopSpecFileWatchResponse,
} from "@/features/specs/types/watch";
import {
  SpecViewSelection,
  type SpecViewSelection as SpecViewSelectionType,
} from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createSelection(specId: string): SpecViewSelectionType {
  return SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString("/workspace"),
    specId: TestValues.specId(specId),
    fileKey: "impl",
  });
}

function createStartResponse(specId: string): StartSpecFileWatchResponse {
  return {
    workspacePath: "/workspace",
    specId: TestValues.specId(specId),
    fileKey: "impl",
    strategy: "native",
    watchedPaths: [],
    skippedPaths: [],
    debounceMs: 100,
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

test("AからBへの切替で完了順が逆転しても最終的にBだけを監視する", async () => {
  const startA = createDeferred<StartSpecFileWatchResponse>();
  const startB = createDeferred<StartSpecFileWatchResponse>();
  const stop = createDeferred<StopSpecFileWatchResponse>();
  const settledOperations: string[] = [];
  let activeSpecId: string | null = null;
  const startWatch = vi
    .fn<StartSpecFileWatchCommand>()
    .mockImplementationOnce((request) =>
      startA.promise.then((response) => {
        activeSpecId = request.specId;
        settledOperations.push(`start:${request.specId}`);
        return response;
      }),
    )
    .mockImplementationOnce((request) =>
      startB.promise.then((response) => {
        activeSpecId = request.specId;
        settledOperations.push(`start:${request.specId}`);
        return response;
      }),
    );
  const stopWatch = vi.fn<StopSpecFileWatchCommand>(() =>
    stop.promise.then((response) => {
      activeSpecId = null;
      settledOperations.push("stop");
      return response;
    }),
  );
  const subscribe = vi.fn(async () => vi.fn()) as SpecFileWatchSubscriber;
  const onMarkdownChange = vi.fn();
  const container = document.createElement("div");
  const root = createRoot(container);

  function TestComponent({ specId }: Readonly<{ specId: string }>): null {
    useSpecFileWatcher({
      selection: createSelection(specId),
      onMarkdownChange,
      startWatch,
      stopWatch,
      subscribe,
    });
    return null;
  }

  act(() => {
    root.render(<TestComponent specId="spec-a" />);
  });
  await flush();
  act(() => {
    root.render(<TestComponent specId="spec-b" />);
  });
  await flush();

  startB.resolve(createStartResponse("spec-b"));
  await flush();
  stop.resolve({ stopped: true });
  await flush();
  startA.resolve(createStartResponse("spec-a"));
  await flush();

  expect(activeSpecId).toBe("spec-b");
  expect(settledOperations).toEqual(["start:spec-a", "stop", "start:spec-b"]);
  expect(stopWatch).toHaveBeenCalledTimes(1);

  act(() => {
    root.unmount();
  });
  await flush();

  expect(activeSpecId).toBeNull();
  expect(stopWatch).toHaveBeenCalledTimes(2);
  container.remove();
});
