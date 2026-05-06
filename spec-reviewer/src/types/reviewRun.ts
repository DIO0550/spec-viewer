import type {
  CommentId,
  ExportCommentsTarget,
  IsoDateTimeString,
} from "./comment";
import type { SpecFileKey } from "./spec";

export type ReviewRunSchemaVersion = "spec-reviewer.review-run.v1";

export type ReviewRunStatus =
  | "active"
  | "inProgress"
  | "completed"
  | "archived";

export type ReviewRunTarget = Extract<
  ExportCommentsTarget,
  { scope: "file" } | { scope: "spec" }
>;

export type ReviewRunExecutionMode = "currentWorkspace" | "worktree";

export type ReviewRunExecutionTarget =
  | Readonly<{
      mode: "currentWorkspace";
      workspacePath: string;
    }>
  | Readonly<{
      mode: "worktree";
      repositoryPath: string;
      worktreePath: string;
      branchName: string;
    }>;

export type ReviewRunSourceFile = Readonly<{
  specId: string;
  fileKey: SpecFileKey;
  relativePath: string;
}>;

export type ReviewRunManifest = Readonly<{
  schemaVersion: ReviewRunSchemaVersion;
  id: string;
  status: ReviewRunStatus;
  workspacePath: string;
  target: ReviewRunTarget;
  specFolderPath: string;
  executionTarget: ReviewRunExecutionTarget;
  sourceFiles: readonly ReviewRunSourceFile[];
  commentIds: readonly CommentId[];
  createdAt: IsoDateTimeString;
  archivedAt: IsoDateTimeString | null;
}>;

export type ReviewRunStatusDocument = Readonly<{
  status: ReviewRunStatus;
  updatedAt: IsoDateTimeString;
  summary: string | null;
  warnings: readonly string[];
}>;

export type ReviewRun = Readonly<{
  id: string;
  status: ReviewRunStatus;
  target: ReviewRunTarget;
  executionTarget: ReviewRunExecutionTarget;
  specFolderPath: string;
  folderPath: string;
  sourceFiles: readonly ReviewRunSourceFile[];
  commentCount: number;
  createdAt: IsoDateTimeString;
  archivedAt: IsoDateTimeString | null;
}>;

export type CreateReviewRunRequest = Readonly<{
  workspacePath: string;
  target: ReviewRunTarget;
  commentIds: readonly CommentId[];
  executionMode: ReviewRunExecutionMode;
}>;

export type CreateReviewRunResponse = Readonly<{
  reviewRun: ReviewRun;
}>;

export type ListReviewRunsRequest = Readonly<{
  workspacePath: string;
  target: ReviewRunTarget;
}>;

export type ListReviewRunsResponse = Readonly<{
  active: readonly ReviewRun[];
  archived: readonly ReviewRun[];
}>;

export type ArchiveReviewRunRequest = Readonly<{
  workspacePath: string;
  target: ReviewRunTarget;
  reviewRunId: string;
}>;

export type ArchiveReviewRunResponse = Readonly<{
  reviewRun: ReviewRun;
}>;

export type ReviewRunCommandPayloads = Readonly<{
  create_review_run: Readonly<{
    request: CreateReviewRunRequest;
    response: CreateReviewRunResponse;
  }>;
  list_review_runs: Readonly<{
    request: ListReviewRunsRequest;
    response: ListReviewRunsResponse;
  }>;
  archive_review_run: Readonly<{
    request: ArchiveReviewRunRequest;
    response: ArchiveReviewRunResponse;
  }>;
}>;
