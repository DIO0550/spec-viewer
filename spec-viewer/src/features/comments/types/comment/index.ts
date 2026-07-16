import type {
  Comment as DomainComment,
  CommentAnchorResolution as DomainCommentAnchorResolution,
  CommentAnchorResolutionReason as DomainCommentAnchorResolutionReason,
  CommentAnchorResolutionStatus as DomainCommentAnchorResolutionStatus,
  CommentAnchorResolutionTarget as DomainCommentAnchorResolutionTarget,
} from "@/features/comments/domain/comment";
import type { CommentBody } from "@/features/comments/domain/commentBody";
import type {
  BlockType,
  CharRange,
  CommentAnchor as DomainCommentAnchor,
} from "@/features/comments/domain/commentAnchor";
import type {
  CommentStatus,
  CommentStatusFilter,
} from "@/features/comments/domain/commentStatusFilter";
import type { CommentId as BrandedCommentId } from "@/shared/domain/commentId";
import { CommentId as CommentIdValue } from "@/shared/domain/commentId";
import type { IsoDateTimeString } from "@/shared/domain/isoDateTime";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import type { SpecId } from "@/shared/domain/specId";

export type CommentId = BrandedCommentId;
export const CommentId = CommentIdValue;
export type {
  CommentStatus,
  CommentStatusFilter,
} from "@/features/comments/domain/commentStatusFilter";

export type { IsoDateTimeString } from "@/shared/domain/isoDateTime";

export type CommentBlockType = BlockType;

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

export type CommentAnchorResolutionStatus = DomainCommentAnchorResolutionStatus;

export type CommentAnchorResolutionReason = DomainCommentAnchorResolutionReason;

export type CommentCharRange = CharRange;

export type CommentAnchor = DomainCommentAnchor;

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
  body: CommentBody;
}>;

export type CommentAnchorResolutionTarget = DomainCommentAnchorResolutionTarget;

export type CommentAnchorResolution = DomainCommentAnchorResolution;

export type Comment = DomainComment;

export type CommentViewModel = Readonly<{
  comment: Comment;
  displayState: CommentDisplayState;
  isResolved: boolean;
  isOrphaned: boolean;
  canJumpToAnchor: boolean;
}>;

export type CommentAnchorDisplayState = Readonly<{
  commentId: CommentId;
  status: CommentAnchorDisplayStatus;
}>;

export type ListCommentsRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
  fileKey: SpecFileKey;
  statusFilter?: CommentStatusFilter | null;
  correlationId?: string;
}>;

export type AddCommentRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
  anchor: CommentAnchor;
  body: CommentBody;
}>;

export type UpdateCommentRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
  fileKey: SpecFileKey;
  commentId: CommentId;
  body: CommentBody;
}>;

export type DeleteCommentRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
  fileKey: SpecFileKey;
  commentId: CommentId;
}>;

export type CommentStatusRequest = Readonly<{
  workspacePath: string;
  specId: SpecId;
  fileKey: SpecFileKey;
  commentId: CommentId;
}>;

export type ExportCommentsTarget =
  | Readonly<{
      scope: "file";
      specId: SpecId;
      fileKey: SpecFileKey;
    }>
  | Readonly<{
      scope: "spec";
      specId: SpecId;
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
  id: string;
  fileKey: SpecFileKey;
  body: string;
  status: CommentStatus;
  resolved: boolean;
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
  target: Readonly<{
    scope: "file";
    specId: string;
    fileKey: SpecFileKey;
  }>;
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

export type CommentCommandPayloads = Readonly<{
  list_comments: Readonly<{
    request: ListCommentsRequest;
    response: ListCommentsResponse;
  }>;
  add_comment: Readonly<{
    request: AddCommentRequest;
    response: Comment;
  }>;
  update_comment: Readonly<{
    request: UpdateCommentRequest;
    response: Comment;
  }>;
  delete_comment: Readonly<{
    request: DeleteCommentRequest;
    response: DeleteCommentResponse;
  }>;
  resolve_comment: Readonly<{
    request: CommentStatusRequest;
    response: Comment;
  }>;
  reopen_comment: Readonly<{
    request: CommentStatusRequest;
    response: Comment;
  }>;
  toggle_comment_resolved: Readonly<{
    request: CommentStatusRequest;
    response: Comment;
  }>;
  export_comments: Readonly<{
    request: ExportCommentsRequest;
    response: ExportCommentsResponse;
  }>;
  generate_llm_prompt: Readonly<{
    request: GenerateLlmPromptRequest;
    response: GenerateLlmPromptResponse;
  }>;
}>;
