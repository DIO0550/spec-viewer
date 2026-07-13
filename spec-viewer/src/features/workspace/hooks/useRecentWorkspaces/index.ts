import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { RecentWorkspacesClock } from "@/features/workspace/application/ports/recentWorkspacesClock";
import type { RecentWorkspacesRepository } from "@/features/workspace/application/ports/recentWorkspacesRepository";
import {
  RecentWorkspaces,
  type RecentWorkspace,
  type RecentWorkspaces as RecentWorkspacesValue,
} from "@/features/workspace/domain/recentWorkspaces";
import type { Workspace } from "@/features/workspace/domain/workspace";
import type { WorkspacePath } from "@/features/workspace/domain/workspacePath";

export type UseRecentWorkspacesOptions = Readonly<{
  repository: RecentWorkspacesRepository;
  clock: RecentWorkspacesClock;
}>;

export type UseRecentWorkspacesResult = Readonly<{
  recentWorkspaces: readonly RecentWorkspace[];
  lastActiveWorkspacePath: WorkspacePath | null;
  /** @param workspace - 最近使用した一覧へ記録するワークスペース。 */
  recordWorkspace: (workspace: Workspace) => void;
  /** @param path - 一覧から削除するワークスペースのパス。 */
  removeWorkspace: (path: WorkspacePath) => void;
  /** 最近使用したワークスペースをすべて消去する。 */
  clearWorkspaces: () => void;
}>;

/**
 * @param options - Recent-workspaces repository and clock ports.
 * @returns Recent workspace state synchronized through the repository port.
 */
export function useRecentWorkspaces(
  options: UseRecentWorkspacesOptions,
): UseRecentWorkspacesResult {
  const { clock, repository } = options;
  const [recentWorkspaces, setRecentWorkspaces] =
    useState<RecentWorkspacesValue>(() => repository.load());
  const recentWorkspacesRef = useRef(recentWorkspaces);
  const repositoryRef = useRef(repository);

  useLayoutEffect(() => {
    if (repositoryRef.current === repository) {
      return;
    }

    const restored = repository.load();
    repositoryRef.current = repository;
    recentWorkspacesRef.current = restored;
    setRecentWorkspaces(restored);
  }, [repository]);

  const recordWorkspace = useCallback(
    (workspace: Workspace): void => {
      const next = RecentWorkspaces.record(
        recentWorkspacesRef.current,
        workspace,
        clock.now(),
      );
      recentWorkspacesRef.current = next;
      repository.save(next);
      setRecentWorkspaces(next);
    },
    [clock, repository],
  );

  const removeWorkspace = useCallback(
    (path: WorkspacePath): void => {
      const next = RecentWorkspaces.remove(recentWorkspacesRef.current, path);
      recentWorkspacesRef.current = next;
      repository.save(next);
      setRecentWorkspaces(next);
    },
    [repository],
  );

  const clearWorkspaces = useCallback((): void => {
    const next = RecentWorkspaces.clear();
    recentWorkspacesRef.current = next;
    repository.clear();
    setRecentWorkspaces(next);
  }, [repository]);

  return {
    recentWorkspaces: recentWorkspaces.entries,
    lastActiveWorkspacePath: recentWorkspaces.lastActiveWorkspacePath,
    recordWorkspace,
    removeWorkspace,
    clearWorkspaces,
  };
}
