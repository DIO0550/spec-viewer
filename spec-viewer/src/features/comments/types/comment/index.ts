import type {
  Comment,
  IsoDateTimeString,
} from "@/features/comments/domain/comment";
import type {
  CommentAnchor,
  CommentAnchorResolution,
} from "@/features/comments/domain/commentAnchor";
import type { CommentId } from "@/features/comments/domain/commentId";
import type {
  CommentStatus,
  CommentStatusFilter,
} from "@/features/comments/domain/commentStatusFilter";
import type { SpecFileKey } from "@/features/specs/domain/specFile";

export type CommentDisplayFilter =
  | CommentStatusFilter
  | "moved"
  | "fuzzy"
  | "stale"
  | "orphaned";

export type CommentDisplayState = CommentStatus | "orphaned";

export type CommentAnchorDisplayStatus =
  | "exact"
  | "moved"
  | "fuzzy"
  | "orphaned"
  | "stale";

export type CommentSelectionBounds = Readonly<{
  top: number;
  left: number;
  width: number;
  height: number;
  commentLaneLeft?: number;
}>;

export type CommentAnchorDraft = Readonly<{
  anchor: CommentAnchor;
  selectionBounds: CommentSelectionBounds;
}>;

export type AddCommentSubmitInput = Readonly<{
  anchor: CommentAnchor;
  body: string;
}>;

export type CommentViewModel = Readonly<{
  comment: Comment;
  displayState: CommentDisplayState;
  isOrphaned: boolean;
  canJumpToAnchor: boolean;
}>;

export type CommentAnchorDisplayState = Readonly<{
  commentId: CommentId;
  status: CommentAnchorDisplayStatus;
}>;

export type ListCommentsRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  statusFilter?: CommentStatusFilter | null;
  correlationId?: string;
}>;

export type AddCommentRequest = Readonly<{
  workspacePath: string;
  specId: string;
  anchor: CommentAnchor;
  body: string;
}>;

export type UpdateCommentRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  commentId: CommentId;
  body: string;
}>;

export type DeleteCommentRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  commentId: CommentId;
}>;

export type CommentStatusRequest = Readonly<{
  workspacePath: string;
  specId: string;
  fileKey: SpecFileKey;
  commentId: CommentId;
}>;

export type ExportCommentsTarget =
  | Readonly<{
      scope: "file";
      specId: string;
      fileKey: SpecFileKey;
    }>
  | Readonly<{
      scope: "spec";
      specId: string;
    }>
  | Readonly<{
      scope: "workspace";
    }>;

export type CommentExportScope = ExportCommentsTarget["scope"];

export type CommentExportOperation = CommentExportScope | "mcpFeedback";

export type ExportCommentsRequest = Readonly<{
  workspacePath: string;
  target: ExportCommentsTarget;
  destinationPath: string;
}>;

export type GenerateLlmPromptRequest = Readonly<{
  workspacePath: string;
  target: ExportCommentsTarget;
}>;

export type ApplyWithAiCommentSelectionInput = Readonly<{
  workspacePath: string;
  target: ExportCommentsTarget;
  commentIds: readonly CommentId[];
}>;

export type ApplyWithAiGeneratedDiffPreviewFile = Readonly<{
  fileKey: SpecFileKey;
  originalMarkdown: string;
  proposedMarkdown: string;
  unifiedDiff: string;
}>;

export type ApplyWithAiGeneratedDiffPreview =
  | Readonly<{
      status: "notGenerated";
      files: readonly [];
    }>
  | Readonly<{
      status: "ready";
      files: readonly ApplyWithAiGeneratedDiffPreviewFile[];
      requiresExplicitConfirmation: true;
    }>;

export type ApplyWithAiPlaceholderState = Readonly<{
  availability: "placeholder";
  enabled: false;
  selectedCommentsInput: ApplyWithAiCommentSelectionInput | null;
  generatedDiffPreview: ApplyWithAiGeneratedDiffPreview;
  requiresExplicitUserConfirmationBeforeWrite: true;
  markdownWriteSupport: "notConnected";
  explanation: string;
}>;

export type SpecSkillMcpFeedbackInterface = Readonly<{
  protocol: "mcp";
  serverName: "spec-skill";
  toolName: "spec_skill.feedback.submit";
  transport: "manual-copy";
}>;

export type SpecSkillMcpFeedbackComment = Readonly<{
  id: CommentId;
  fileKey: SpecFileKey;
  body: string;
  status: CommentStatus;
  anchor: CommentAnchor;
  anchorResolution: CommentAnchorResolution | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}>;

export type SpecSkillMcpFeedbackPayload = Readonly<{
  schemaVersion: "spec-reviewer.mcp-feedback.v1";
  interface: SpecSkillMcpFeedbackInterface;
  mode: "dryRun";
  workspacePath: string;
  target: Extract<ExportCommentsTarget, { scope: "file" }>;
  generatedAt: IsoDateTimeString;
  dryRun: Readonly<{
    callProvider: false;
    writeMarkdown: false;
    userVisibleSummary: string;
  }>;
  summary: Readonly<{
    commentCount: number;
    openCommentCount: number;
    resolvedCommentCount: number;
    orphanedCommentCount: number;
  }>;
  comments: readonly SpecSkillMcpFeedbackComment[];
}>;

export type ListCommentsResponse = Readonly<{
  comments: readonly Comment[];
}>;

export type DeleteCommentResponse = Readonly<{
  deleted: boolean;
}>;

export type ExportCommentsResponse = Readonly<{
  destinationPath: string;
  format: "markdown" | "json";
  commentCount: number;
}>;

export type GenerateLlmPromptResponse = Readonly<{
  prompt: string;
  commentCount: number;
  contextFileCount: number;
}>;
