import type {
  WorkspaceError,
  WorkspaceErrorReason,
} from "@/features/workspace/domain/workspaceError";

export type WorkspaceFeatureError = Readonly<{
  feature: "workspace";
  reason: WorkspaceErrorReason;
  message: string;
  domainError: WorkspaceError;
  cause: unknown;
}>;
