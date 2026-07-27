import type { ChangedFile } from "./changedFile";
import type { WorktreeSpec } from "./worktreeSpec";

export type WorktreeId = string;

export type Worktree = Readonly<{
  id: WorktreeId;
  name: string;
  categoryPath: readonly string[];
  specs: readonly WorktreeSpec[];
  changedFiles: readonly ChangedFile[];
}>;
