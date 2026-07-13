import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import type { RecentWorkspacesRepository } from "@/features/workspace/application/ports/recentWorkspacesRepository";
import {
  RecentWorkspaces,
  type RecentWorkspaces as RecentWorkspacesValue,
} from "@/features/workspace/domain/recentWorkspaces";
import { useRecentWorkspaces } from "@/features/workspace/hooks/useRecentWorkspaces";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

class MemoryRecentWorkspacesRepository implements RecentWorkspacesRepository {
  private recentWorkspaces: RecentWorkspacesValue;
  saveCallCount = 0;
  clearCallCount = 0;

  constructor(recentWorkspaces = RecentWorkspaces.empty()) {
    this.recentWorkspaces = recentWorkspaces;
  }

  load(): RecentWorkspacesValue {
    return this.recentWorkspaces;
  }

  save(recentWorkspaces: RecentWorkspacesValue): void {
    this.saveCallCount += 1;
    this.recentWorkspaces = recentWorkspaces;
  }

  clear(): void {
    this.clearCallCount += 1;
    this.recentWorkspaces = RecentWorkspaces.empty();
  }
}

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

function renderHook<Result>(hook: () => Result): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  act(() => {
    root.render(
      <StrictMode>
        <TestComponent />
      </StrictMode>,
    );
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

test("useRecentWorkspacesはrepositoryのaggregateを初期状態として復元する", () => {
  const repository = new MemoryRecentWorkspacesRepository(
    RecentWorkspaces.restore({
      entries: [
        {
          path: workspacePathFixture("/workspace/alpha"),
          displayName: "alpha",
          kind: "plugin-workspace",
          lastOpenedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
    }),
  );
  const result = renderHook(() =>
    useRecentWorkspaces({
      repository,
      clock: { now: () => "2026-05-02T00:00:00.000Z" },
    }),
  );

  expect(result.current.recentWorkspaces.map(({ path }) => path)).toEqual([
    "/workspace/alpha",
  ]);
  expect(result.current.lastActiveWorkspacePath).toBe("/workspace/alpha");
  result.unmount();
});

test("useRecentWorkspacesはclockの時刻でrecordしrepositoryへaggregateを保存する", () => {
  const repository = new MemoryRecentWorkspacesRepository();
  const result = renderHook(() =>
    useRecentWorkspaces({
      repository,
      clock: { now: () => "2026-05-03T00:00:00.000Z" },
    }),
  );

  act(() => {
    result.current.recordWorkspace({
      root: workspacePathFixture("/workspace/alpha"),
      kind: "spec-skill",
      files: [],
    });
  });

  expect(repository.load()).toEqual({
    entries: [
      {
        path: "/workspace/alpha",
        displayName: "alpha",
        kind: "spec-skill",
        lastOpenedAt: "2026-05-03T00:00:00.000Z",
      },
    ],
    lastActiveWorkspacePath: "/workspace/alpha",
  });
  expect(repository.saveCallCount).toBe(1);
  result.unmount();
});

test("useRecentWorkspacesはremoveとclearをrepositoryへ同期する", () => {
  const repository = new MemoryRecentWorkspacesRepository();
  const result = renderHook(() =>
    useRecentWorkspaces({
      repository,
      clock: { now: () => "2026-05-03T00:00:00.000Z" },
    }),
  );

  act(() => {
    result.current.recordWorkspace({
      root: workspacePathFixture("/workspace/alpha"),
      kind: "plugin-workspace",
      files: [],
    });
  });

  act(() => {
    result.current.removeWorkspace(
      workspacePathFixture("file:///workspace/alpha/"),
    );
  });

  expect(repository.load()).toEqual(RecentWorkspaces.empty());
  expect(repository.saveCallCount).toBe(2);

  act(() => {
    result.current.clearWorkspaces();
  });

  expect(result.current.recentWorkspaces).toEqual([]);
  expect(result.current.lastActiveWorkspacePath).toBeNull();
  expect(repository.clearCallCount).toBe(1);
  result.unmount();
});

test("useRecentWorkspacesはrepository差し替え時にaggregateを再同期する", () => {
  const firstRepository = new MemoryRecentWorkspacesRepository(
    RecentWorkspaces.restore({
      entries: [
        {
          path: workspacePathFixture("/workspace/alpha"),
          displayName: "alpha",
          kind: "plugin-workspace",
          lastOpenedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
    }),
  );
  const currentRepository = new MemoryRecentWorkspacesRepository(
    RecentWorkspaces.restore({
      entries: [
        {
          path: workspacePathFixture("/workspace/beta"),
          displayName: "beta",
          kind: "plugin-workspace",
          lastOpenedAt: "2026-05-02T00:00:00.000Z",
        },
      ],
      lastActiveWorkspacePath: workspacePathFixture("/workspace/beta"),
    }),
  );
  const container = document.createElement("div");
  const root = createRoot(container);
  const hookResult: {
    current: ReturnType<typeof useRecentWorkspaces> | undefined;
  } = {
    current: undefined,
  };

  function TestComponent({
    repository,
  }: Readonly<{ repository: RecentWorkspacesRepository }>): null {
    hookResult.current = useRecentWorkspaces({
      repository,
      clock: { now: () => "2026-05-03T00:00:00.000Z" },
    });
    return null;
  }

  act(() => {
    root.render(
      <StrictMode>
        <TestComponent repository={firstRepository} />
      </StrictMode>,
    );
  });
  act(() => {
    root.render(
      <StrictMode>
        <TestComponent repository={currentRepository} />
      </StrictMode>,
    );
  });

  expect(hookResult.current?.recentWorkspaces.map(({ path }) => path)).toEqual([
    "/workspace/beta",
  ]);
  expect(hookResult.current?.lastActiveWorkspacePath).toBe("/workspace/beta");
  expect(firstRepository.saveCallCount).toBe(0);
  expect(currentRepository.saveCallCount).toBe(0);
  act(() => {
    hookResult.current?.recordWorkspace({
      root: workspacePathFixture("/workspace/gamma"),
      kind: "plugin-workspace",
      files: [],
    });
  });

  expect(firstRepository.load().entries.map(({ path }) => path)).toEqual([
    "/workspace/alpha",
  ]);
  expect(currentRepository.load().entries.map(({ path }) => path)).toEqual([
    "/workspace/gamma",
    "/workspace/beta",
  ]);
  expect(firstRepository.saveCallCount).toBe(0);
  expect(currentRepository.saveCallCount).toBe(1);

  act(() => {
    root.unmount();
  });
});
