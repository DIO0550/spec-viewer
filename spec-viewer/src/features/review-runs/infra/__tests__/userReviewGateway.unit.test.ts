import { expect, test, vi } from "vitest";

import {
  archiveUserReview,
  createListUserReviewsRequest,
  createUserReview,
  listUserReviews,
} from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewCommands } from "@/shared/api/tauri";
import type { UserReviewDto } from "@/features/review-runs/types/userReviewIpc";
import { CommentId } from "@/features/comments/types/comment";

const target = {
  scope: "file",
  specId: "auth",
  fileKey: "tasks",
} as const;

const activeReview = createUserReviewDto({
  id: "review-active",
  status: "active",
  archivedAt: null,
});

test("createListUserReviewsRequestはcorrelationIdがnullなら省略する", () => {
  expect(
    createListUserReviewsRequest("/workspace/spec-reviewer", target, null),
  ).toEqual({
    workspacePath: "/workspace/spec-reviewer",
    target,
  });
});

test("listUserReviewsはresponseをnormalizeして返す", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue({
      active: [activeReview],
      archived: [],
      problems: [],
    }),
  });

  const response = await listUserReviews(
    commands,
    "/workspace/spec-reviewer",
    target,
    "corr-1",
  );

  expect(response.active).toEqual([activeReview]);
  expect(commands.listUserReviews).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    target,
    correlationId: "corr-1",
  });
});

test("createUserReviewはinvalid lifecycle responseをrejectする", async () => {
  const commands = createCommands({
    createUserReview: vi.fn().mockResolvedValue({
      userReview: createUserReviewDto({
        id: "review-invalid",
        status: "archived",
        archivedAt: null,
      }),
    }),
  });

  await expect(
    createUserReview(commands, "/workspace/spec-reviewer", target, {
      commentIds: [CommentId.fromString("cmt_1")],
      workspaceMode: "currentWorkspace",
    }),
  ).rejects.toThrow("Archived user review must have archivedAt");
});

test("archiveUserReviewはresponseをnormalizeして返す", async () => {
  const archivedReview = createUserReviewDto({
    id: "review-archived",
    status: "archived",
    archivedAt: "2026-05-06T12:30:00Z",
  });
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: archivedReview,
    }),
  });

  const response = await archiveUserReview(
    commands,
    "/workspace/spec-reviewer",
    target,
    "review-archived",
  );

  expect(response.userReview).toEqual(archivedReview);
});

function createCommands(
  commands: Partial<UserReviewCommands>,
): UserReviewCommands {
  return {
    createUserReview: vi.fn().mockResolvedValue({ userReview: activeReview }),
    listUserReviews: vi.fn().mockResolvedValue({
      active: [],
      archived: [],
      problems: [],
    }),
    archiveUserReview: vi.fn().mockResolvedValue({ userReview: activeReview }),
    ...commands,
  };
}

function createUserReviewDto(
  input: Pick<UserReviewDto, "archivedAt" | "id" | "status">,
): UserReviewDto {
  return {
    id: input.id,
    status: input.status,
    target,
    workspace: {
      mode: "currentWorkspace",
      workspacePath: "/workspace/spec-reviewer",
    },
    specFolderPath: "/workspace/spec-reviewer/.plugin-workspace/.specs/auth",
    folderPath: `/workspace/spec-reviewer/.plugin-workspace/.specs/auth/user-review/active/${input.id}`,
    sourceFiles: [],
    commentCount: 1,
    createdAt: "2026-05-06T12:00:00Z",
    archivedAt: input.archivedAt,
    summary: null,
    warnings: [],
  } as UserReviewDto;
}
