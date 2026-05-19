import type { SpecFileKey } from "@/features/specs/types/spec";

export type CommentId = string;

export type IsoDateTimeString = string;

export type CommentBlockType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "code_block"
  | "block_quote"
  | "table"
  | "thematic_break"
  | "html"
  | "other";

export type CommentStatus = "open" | "resolved";

const commentStatusFilterValues = ["all", "open", "resolved"] as const;

export type CommentStatusFilter = (typeof commentStatusFilterValues)[number];

/**
 * 入力値をコメントステータスフィルタへ変換する。
 *
 * @param value - 外部境界または UI 状態から渡される入力値
 * @returns 有効なフィルタ。不正値の場合は null
 */
function parseCommentStatusFilter(
  value: unknown,
): CommentStatusFilter | null {
  if (value === null || value === undefined) {
    return CommentStatusFilter.All;
  }

  if (!isCommentStatusFilter(value)) {
    return null;
  }

  return value;
}

/**
 * 入力値がコメントステータスフィルタか判定する。
 *
 * @param value - 判定対象
 * @returns コメントステータスフィルタの場合 true
 */
function isCommentStatusFilter(value: unknown): value is CommentStatusFilter {
  switch (value) {
    case "all":
    case "open":
    case "resolved":
      return true;
    default:
      return false;
  }
}

/**
 * コメントステータスフィルタを IPC 互換の文字列へ変換する。
 *
 * @param filter - コメントステータスフィルタ
 * @returns IPC payload と同じ文字列
 */
function stringifyCommentStatusFilter(
  filter: CommentStatusFilter,
): CommentStatusFilter {
  return filter;
}

/**
 * コメントのステータスがフィルタ条件に一致するか判定する。
 *
 * @param filter - コメントステータスフィルタ
 * @param status - コメントステータス
 * @returns 表示対象の場合 true
 */
function matchesCommentStatusFilter(
  filter: CommentStatusFilter,
  status: CommentStatus,
): boolean {
  if (filter === "all") {
    return true;
  }

  return status === filter;
}

export const CommentStatusFilter = {
  All: "all",
  Open: "open",
  Resolved: "resolved",
  values: commentStatusFilterValues,
  parse: parseCommentStatusFilter,
  is: isCommentStatusFilter,
  toString: stringifyCommentStatusFilter,
  matches: matchesCommentStatusFilter,
} as const;

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

export type CommentAnchorResolutionStatus =
  | "resolved"
  | "moved"
  | "fuzzy"
  | "orphaned";

export type CommentAnchorResolutionReason =
  | "exact_match"
  | "moved_by_hash"
  | "stale_snippet"
  | "fuzzy_match"
  | "missing_original_block"
  | "ambiguous_fuzzy_candidates"
  | "below_threshold"
  | "deleted_text"
  | "unsupported_block_type";

export type CommentCharRange = Readonly<{
  start: number;
  end: number;
}>;

export type CommentAnchor = Readonly<{
  fileKey: SpecFileKey;
  blockType: CommentBlockType;
  blockIndex: number;
  textHash: string;
  textSnippet: string;
  charRange: CommentCharRange;
}>;

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

export type CommentAnchorResolutionTarget = Readonly<{
  blockType: CommentBlockType;
  blockIndex: number;
  textHash: string;
  textSnippet: string;
  sourceRange: Readonly<{
    startByteOffset: number;
    endByteOffset: number;
  }> | null;
  score: number;
}>;

export type CommentAnchorResolution = Readonly<{
  status: CommentAnchorResolutionStatus;
  reason: CommentAnchorResolutionReason;
  details: string | null;
  target: CommentAnchorResolutionTarget | null;
}>;

export type Comment = Readonly<{
  id: CommentId;
  anchor: CommentAnchor;
  body: string;
  status: CommentStatus;
  resolved: boolean;
  anchorResolution?: CommentAnchorResolution | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}>;

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
