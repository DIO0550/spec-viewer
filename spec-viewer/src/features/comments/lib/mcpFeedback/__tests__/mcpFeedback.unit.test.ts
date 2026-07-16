import * as TestValues from "@/shared/testing/validatedValueObjects";
import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { createCommentTestFixture } from "@/features/comments/testing/comment-test-fixture";
import { expect, test } from "vitest";

import { createSpecSkillMcpFeedbackDryRunPayload } from "@/features/comments/lib/mcpFeedback";
import { renderSpecSkillMcpFeedbackDryRunPayload } from "@/features/comments/lib/mcpFeedback";
const anchoredComment = createCommentTestFixture({
  id: "cmt_open",
  anchor: createCommentAnchorTestFixture({
    fileKey: "tasks",
    blockType: "paragraph",
    blockIndex: 4,
    textHash: "sha256:0e3a0001",
    textSnippet: "Feedback payload should stay copyable",
    charRange: {
      start: 0,
      end: 18,
    },
  }),
  body: "Clarify the feedback handoff boundary.",
  anchorResolution: {
    status: "resolved",
    reason: "exact_match",
    details: null,
    target: null,
  },
  createdAt: "2026-05-06T10:00:00Z",
  updatedAt: "2026-05-06T10:15:00Z",
});

const orphanedComment = createCommentTestFixture({
  id: "cmt_orphaned",
  anchor: anchoredComment.anchor,
  body: "Carry orphaned comments into the Spec Skill feedback path.",
  status: "resolved",
  anchorResolution: {
    status: "orphaned",
    reason: "deleted_text",
    details: "Original paragraph was removed.",
    target: null,
  },
  createdAt: "2026-05-06T11:00:00Z",
  updatedAt: "2026-05-06T11:15:00Z",
});

test("Spec Skill MCP feedback dry-run payloadは対象interfaceとcomment summaryを含む", () => {
  const payload = createSpecSkillMcpFeedbackDryRunPayload({
    workspacePath: "/workspace/spec-reviewer",
    specId: TestValues.specId("later-phases"),
    fileKey: "tasks",
    comments: [anchoredComment, orphanedComment],
    generatedAt: "2026-05-06T12:00:00Z",
  });

  expect(payload.mode).toBe("dryRun");
  expect(payload.interface.toolName).toBe("spec_skill.feedback.submit");
  expect(payload.target).toEqual({
    scope: "file",
    specId: TestValues.specId("later-phases"),
    fileKey: "tasks",
  });
  expect(payload.summary).toEqual({
    commentCount: 2,
    openCommentCount: 1,
    resolvedCommentCount: 1,
    orphanedCommentCount: 1,
  });
  expect(payload.comments.map((comment) => comment.id)).toEqual([
    "cmt_open",
    "cmt_orphaned",
  ]);
});

test("Spec Skill MCP feedback dry-run payloadはcopy用JSONとして復元できる", () => {
  const payload = createSpecSkillMcpFeedbackDryRunPayload({
    workspacePath: "/workspace/spec-reviewer",
    specId: TestValues.specId("later-phases"),
    fileKey: "tasks",
    comments: [anchoredComment],
    generatedAt: "2026-05-06T12:00:00Z",
  });

  const copiedPayload = JSON.parse(
    renderSpecSkillMcpFeedbackDryRunPayload(payload),
  );

  expect(copiedPayload.schemaVersion).toBe("spec-reviewer.mcp-feedback.v1");
  expect(copiedPayload.dryRun.callProvider).toBe(false);
  expect(copiedPayload.dryRun.userVisibleSummary).toBe(
    "Prepared dry-run MCP feedback payload for 1 open comment and 0 resolved comments.",
  );
});
