import type { WorkspaceKind } from "@/features/workspace/domain/workspace";

export type RecentWorkspace = Readonly<{
  path: string;
  displayName: string;
  kind: WorkspaceKind;
  lastOpenedAt: string;
}>;

export type RecentWorkspaceStorage = Readonly<{
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}>;
