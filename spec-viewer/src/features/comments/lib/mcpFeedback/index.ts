import type {
  Comment,
  SpecSkillMcpFeedbackComment,
  SpecSkillMcpFeedbackInterface,
  SpecSkillMcpFeedbackPayload,
} from "@/features/comments/types/comment";
import type { SpecFileKey } from "@/shared/types/specFileKey";

type CreateSpecSkillMcpFeedbackDryRunPayloadInput = Readonly<{
  workspacePath: string;
  specId: string;
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
  const openCommentCount = comments.filter(
    (comment) => comment.status === "open",
  ).length;
  const resolvedCommentCount = comments.filter(
    (comment) => comment.status === "resolved",
  ).length;
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
      specId,
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

/**
 * @param payload - The prepared MCP feedback dry-run payload
 * @returns Pretty JSON intended for clipboard-based MCP feedback dry-runs.
 */
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

/**
 * @param comment - The full comment to project
 * @returns The comment subset carried across the manual MCP feedback boundary.
 */
function createSpecSkillMcpFeedbackComment(
  comment: Comment,
): SpecSkillMcpFeedbackComment {
  return {
    id: comment.id,
    fileKey: comment.anchor.fileKey,
    body: comment.body,
    status: comment.status,
    resolved: comment.resolved,
    anchor: comment.anchor,
    anchorResolution: comment.anchorResolution ?? null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

/**
 * @param count - The number of comments
 * @param label - The status label to include
 * @returns A singular or plural comment count label.
 */
function formatCommentCount(count: number, label: string): string {
  const suffix = count === 1 ? "comment" : "comments";

  return `${count} ${label} ${suffix}`;
}
