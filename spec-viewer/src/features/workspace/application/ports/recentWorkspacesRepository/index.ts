import type { RecentWorkspaces } from "@/features/workspace/domain/recentWorkspaces";

export type RecentWorkspacesRepository = Readonly<{
  /** @returns The persisted recent-workspaces aggregate. */
  load: () => RecentWorkspaces;
  /** @param recentWorkspaces - Aggregate to persist. */
  save: (recentWorkspaces: RecentWorkspaces) => void;
  /** Removes all persisted recent-workspaces state. */
  clear: () => void;
}>;
