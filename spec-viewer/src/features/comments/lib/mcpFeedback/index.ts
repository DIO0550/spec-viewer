import { Comment } from "@/features/comments/domain/comment";
import type {
  SpecSkillMcpFeedbackComment,
  SpecSkillMcpFeedbackInterface,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
import { CommentId } from "@/shared/domain/commentId";
import { IsoDateTime } from "@/shared/domain/isoDateTime";
import type { SpecFileKey } from "@/shared/domain/specFileKey";
import { SpecId, type SpecId as SpecIdType } from "@/shared/domain/specId";

type CreateSpecSkillMcpFeedbackDryRunPayloadInput = Readonly<{
  workspacePath: string;
  specId: SpecIdType;
  fileKey: SpecFileKey;
  comments: readonly Comment[];
  generatedAt: string;
}>;

const specSkillMcpFeedbackInterface: SpecSkillMcpFeedbackInterface = {
  protocol: "mcp",
  serverName: "spec-skill",
  toolName: "spec_skill.feedback.submit",
  transport: "manual-copy",
};

/** @returns A provider-free payload for manually handing review comments to Spec Skill MCP workflows. */
export function createSpecSkillMcpFeedbackDryRunPayload({
  workspacePath,
  specId,
  fileKey,
  comments,
  generatedAt,
}: CreateSpecSkillMcpFeedbackDryRunPayloadInput): SpecSkillMcpFeedbackPayload {
  const openCommentCount = comments.filter(Comment.isOpen).length;
  const resolvedCommentCount = comments.filter(Comment.isResolved).length;
  const orphanedCommentCount = comments.filter(
    (comment) => comment.anchorResolution?.status === "orphaned",
  ).length;

  return {
    schemaVersion: "spec-reviewer.mcp-feedback.v1",
    interface: specSkillMcpFeedbackInterface,
    mode: "dryRun",
    workspacePath,
    target: {
      scope: "file",
      specId: SpecId.toDto(specId),
      fileKey,
    },
    generatedAt,
    dryRun: {
      callProvider: false,
      writeMarkdown: false,
      userVisibleSummary: formatMcpFeedbackDryRunSummary({
        openCommentCount,
        resolvedCommentCount,
      }),
    },
    summary: {
      commentCount: comments.length,
      openCommentCount,
      resolvedCommentCount,
      orphanedCommentCount,
    },
    comments: comments.map(createSpecSkillMcpFeedbackComment),
  };
}

/** @returns Pretty JSON intended for clipboard-based MCP feedback dry-runs. */
export function renderSpecSkillMcpFeedbackDryRunPayload(
  payload: SpecSkillMcpFeedbackPayload,
): string {
  return JSON.stringify(payload, null, 2);
}

/** @returns A compact result summary for the prepared dry-run payload. */
export function formatMcpFeedbackDryRunSummary({
  openCommentCount,
  resolvedCommentCount,
}: Readonly<{
  openCommentCount: number;
  resolvedCommentCount: number;
}>): string {
  return `Prepared dry-run MCP feedback payload for ${formatCommentCount(
    openCommentCount,
    "open",
  )} and ${formatCommentCount(resolvedCommentCount, "resolved")}.`;
}

/** @returns The comment subset carried across the manual MCP feedback boundary. */
function createSpecSkillMcpFeedbackComment(
  comment: Comment,
): SpecSkillMcpFeedbackComment {
  return {
    id: CommentId.toDto(comment.id),
    fileKey: comment.anchor.fileKey,
    body: comment.body,
    status: comment.status,
    resolved: Comment.isResolved(comment),
    anchor: comment.anchor,
    anchorResolution: comment.anchorResolution ?? null,
    createdAt: IsoDateTime.toDto(comment.createdAt),
    updatedAt: IsoDateTime.toDto(comment.updatedAt),
  };
}

/**
 * @param count - Number of comments used to choose singular or plural.
 * @param label - Descriptive label placed before the count suffix.
 * @returns A singular or plural comment count label.
 */
function formatCommentCount(count: number, label: string): string {
  const suffix = count === 1 ? "comment" : "comments";

  return `${count} ${label} ${suffix}`;
}
