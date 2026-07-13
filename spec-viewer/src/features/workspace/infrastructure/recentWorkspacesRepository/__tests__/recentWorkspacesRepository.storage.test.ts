import { expect, test } from "vitest";

import type { RecentWorkspacesRepository } from "@/features/workspace/application/ports/recentWorkspacesRepository";
import { RecentWorkspaces } from "@/features/workspace/domain/recentWorkspaces";
import {
  createLocalStorageRecentWorkspacesRepository,
  type RecentWorkspaceStorage,
} from "@/features/workspace/infrastructure/recentWorkspacesRepository";
import { workspacePathFixture } from "@/features/workspace/testing/workspacePath";

class MemoryStorage implements RecentWorkspaceStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingStorage implements RecentWorkspaceStorage {
  getItem(): string | null {
    throw new Error("get failed");
  }

  removeItem(): void {
    throw new Error("remove failed");
  }

  setItem(): void {
    throw new Error("set failed");
  }
}

test("repositoryはcurrent keyからlegacy dataを復元する", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "spec-reviewer.recent-workspaces",
    JSON.stringify([
      "file:///workspace/alpha/",
      {
        path: "/workspace/beta",
        openedAt: "2026-05-01T00:00:00.000Z",
      },
    ]),
  );
  storage.setItem(
    "spec-reviewer.last-active-workspace",
    "file:///workspace/alpha/",
  );
  const repository: RecentWorkspacesRepository =
    createLocalStorageRecentWorkspacesRepository(storage);

  expect(repository.load()).toEqual({
    entries: [
      {
        path: "/workspace/beta",
        displayName: "beta",
        kind: "plugin-workspace",
        lastOpenedAt: "2026-05-01T00:00:00.000Z",
      },
      {
        path: "/workspace/alpha",
        displayName: "alpha",
        kind: "plugin-workspace",
        lastOpenedAt: "",
      },
    ],
    lastActiveWorkspacePath: "/workspace/alpha",
  });
});

test("repositoryはcurrent keyとdata形式でaggregateを保存する", () => {
  const storage = new MemoryStorage();
  const repository = createLocalStorageRecentWorkspacesRepository(storage);
  const recentWorkspaces = RecentWorkspaces.restore({
    entries: [
      {
        path: workspacePathFixture("/workspace/alpha"),
        displayName: "alpha",
        kind: "plugin-worktree",
        lastOpenedAt: "2026-05-01T00:00:00.000Z",
      },
    ],
    lastActiveWorkspacePath: workspacePathFixture("/workspace/alpha"),
  });

  repository.save(recentWorkspaces);

  expect(
    JSON.parse(storage.getItem("spec-reviewer.recent-workspaces") ?? "null"),
  ).toEqual(recentWorkspaces.entries);
  expect(storage.getItem("spec-reviewer.last-active-workspace")).toBe(
    "/workspace/alpha",
  );
});

test("repositoryはlast activeがない保存時に既存keyを削除する", () => {
  const storage = new MemoryStorage();
  storage.setItem("spec-reviewer.last-active-workspace", "/workspace/obsolete");
  const repository = createLocalStorageRecentWorkspacesRepository(storage);

  repository.save(RecentWorkspaces.empty());

  expect(storage.getItem("spec-reviewer.last-active-workspace")).toBeNull();
});

test("repositoryのclearは両方のcurrent keyを削除する", () => {
  const storage = new MemoryStorage();
  storage.setItem("spec-reviewer.recent-workspaces", "[]");
  storage.setItem("spec-reviewer.last-active-workspace", "/workspace/alpha");
  const repository = createLocalStorageRecentWorkspacesRepository(storage);

  repository.clear();

  expect(storage.getItem("spec-reviewer.recent-workspaces")).toBeNull();
  expect(storage.getItem("spec-reviewer.last-active-workspace")).toBeNull();
});

test("repositoryは利用不能なstorageを空aggregateとして扱う", () => {
  const repository = createLocalStorageRecentWorkspacesRepository(null);

  expect(repository.load()).toEqual(RecentWorkspaces.empty());
  expect(() => repository.save(RecentWorkspaces.empty())).not.toThrow();
  expect(() => repository.clear()).not.toThrow();
});

test("repositoryはstorage I/O例外を境界内で処理する", () => {
  const repository = createLocalStorageRecentWorkspacesRepository(
    new ThrowingStorage(),
  );

  expect(repository.load()).toEqual(RecentWorkspaces.empty());
  expect(() => repository.save(RecentWorkspaces.empty())).not.toThrow();
  expect(() => repository.clear()).not.toThrow();
});
