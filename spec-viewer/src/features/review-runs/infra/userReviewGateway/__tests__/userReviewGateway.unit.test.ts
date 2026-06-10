import { expect, test, vi } from "vitest";
import { CommentId } from "@/features/comments";
import {
  archiveUserReview,
  createListUserReviewsRequest,
  createUserReview,
  listUserReviews,
} from "@/features/review-runs/infra/userReviewGateway";
import type { UserReviewDto } from "@/features/review-runs/types/userReviewIpc";
import type { UserReviewCommands } from "@/shared/api/tauri";

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

test("listUserReviewsはarchive state不整合entryをrejectする", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue({
      active: [
        createUserReviewDto({
          id: "review-invalid-list",
          status: "completed",
          archivedAt: "2026-05-06T12:30:00Z",
        }),
      ],
      archived: [],
      problems: [],
    }),
  });

  await expect(
    listUserReviews(commands, "/workspace/spec-reviewer", target, "corr-1"),
  ).rejects.toThrow(
    "Non-archived user review must not have archivedAt: review-invalid-list",
  );
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

test("archiveUserReviewはarchive state不整合responseをrejectする", async () => {
  const commands = createCommands({
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: createUserReviewDto({
        id: "review-invalid-archive",
        status: "archived",
        archivedAt: null,
      }),
    }),
  });

  await expect(
    archiveUserReview(
      commands,
      "/workspace/spec-reviewer",
      target,
      "review-invalid-archive",
    ),
  ).rejects.toThrow(
    "Archived user review must have archivedAt: review-invalid-archive",
  );
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
