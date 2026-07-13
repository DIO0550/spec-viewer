import { expect, test, vi } from "vitest";

import { CommentId } from "@/features/comments/types/comment";
import { CreateUserReviewCommand } from "@/features/review-runs/domain/createUserReviewCommand";
import type { ActiveUserReview } from "@/features/review-runs/domain/userReview";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { createTauriUserReviewRepository } from "@/features/review-runs/infra/userReviewRepository";
import type { UserReviewCommands } from "@/shared/api/tauri";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
const target: UserReviewTarget = {
  scope: "file",
  specId: "auth-flow",
  fileKey: "tasks",
};
const activeReview: ActiveUserReview = {
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "urv_0123456789abcdef0123456789abcdef",
  status: "active",
  target,
  recordLocator: "urv_0123456789abcdef0123456789abcdef.json",
  commentCount: 1,
  createdAt: "2026-07-13T10:00:00Z",
  updatedAt: "2026-07-13T10:00:00Z",
  archivedAt: null,
};

test("repository listはTauri responseをdomain outcomeへ復元する", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue({
      active: [activeReview],
      archived: [],
      problems: [],
    }),
  });
  const repository = createTauriUserReviewRepository(commands);

  await expect(
    repository.list({ workspacePath, target, correlationId: "list-1" }),
  ).resolves.toEqual({
    ok: true,
    value: { active: [activeReview], archived: [], problems: [] },
  });
  expect(commands.listUserReviews).toHaveBeenCalledWith({
    workspacePath: "/workspace/spec-reviewer",
    target,
    correlationId: "list-1",
  });
});

test("repositoryはbackend error codeをapplication portへ保持する", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockRejectedValue({
      code: "userReviewRepository",
      message: "Review repository is unavailable",
    }),
  });
  const repository = createTauriUserReviewRepository(commands);

  await expect(
    repository.list({ workspacePath, target, correlationId: null }),
  ).resolves.toMatchObject({
    ok: false,
    error: {
      code: "userReviewRepository",
      message: "Review repository is unavailable",
    },
  });
});

test("repositoryはcommand wrapperのraw backend error codeを復元する", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockRejectedValue({
      command: "list_user_reviews",
      code: "unknown",
      message: "Unknown list_user_reviews failure",
      raw: {
        code: "userReviewRepository",
        message: "Review repository is unavailable",
      },
    }),
  });
  const repository = createTauriUserReviewRepository(commands);

  await expect(
    repository.list({ workspacePath, target, correlationId: null }),
  ).resolves.toMatchObject({
    ok: false,
    error: {
      code: "userReviewRepository",
      message: "Review repository is unavailable",
    },
  });
});

test("repositoryはrawとcauseの入れ子からbackend error codeを復元する", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockRejectedValue({
      command: "list_user_reviews",
      code: "unknown",
      message: "Unknown list_user_reviews failure",
      raw: {
        code: "unknown",
        message: "Nested command failure",
        cause: {
          code: "userReviewCollision",
          message: "An active review already exists",
        },
      },
    }),
  });
  const repository = createTauriUserReviewRepository(commands);

  await expect(
    repository.list({ workspacePath, target, correlationId: null }),
  ).resolves.toMatchObject({
    ok: false,
    error: {
      code: "userReviewCollision",
      message: "An active review already exists",
    },
  });
});

test("repositoryは未知のraw codeではcommand wrapperのunknownを保持する", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockRejectedValue({
      command: "list_user_reviews",
      code: "unknown",
      message: "Unknown list_user_reviews failure",
      raw: {
        code: "futureUserReviewFailure",
        message: "Future backend failure",
      },
    }),
  });
  const repository = createTauriUserReviewRepository(commands);

  await expect(
    repository.list({ workspacePath, target, correlationId: null }),
  ).resolves.toMatchObject({
    ok: false,
    error: {
      code: "unknown",
      message: "Unknown list_user_reviews failure",
    },
  });
});

test("repositoryはDTO decode failureをinvalidUserReview outcomeへ変換する", async () => {
  const commands = createCommands({
    listUserReviews: vi.fn().mockResolvedValue({
      active: [{ ...activeReview, commentCount: 0 }],
      archived: [],
      problems: [],
    }),
  });
  const repository = createTauriUserReviewRepository(commands);

  await expect(
    repository.list({ workspacePath, target, correlationId: null }),
  ).resolves.toMatchObject({
    ok: false,
    error: { code: "invalidUserReview" },
  });
});

test("repository create/archiveはvalidated aggregateを返す", async () => {
  const archivedReview = {
    ...activeReview,
    status: "archived" as const,
    updatedAt: "2026-07-13T10:30:00Z",
    archivedAt: "2026-07-13T10:30:00Z",
  };
  const commands = createCommands({
    createUserReview: vi.fn().mockResolvedValue({ userReview: activeReview }),
    archiveUserReview: vi.fn().mockResolvedValue({
      userReview: archivedReview,
    }),
  });
  const repository = createTauriUserReviewRepository(commands);
  const prepared = CreateUserReviewCommand.create({
    workspacePath,
    target,
    commentIds: [CommentId.fromString("cmt_one")],
  });
  expect(prepared.ok).toBe(true);
  const command = (prepared as Extract<typeof prepared, { ok: true }>).command;

  await expect(repository.create(command)).resolves.toEqual({
    ok: true,
    value: activeReview,
  });
  await expect(
    repository.archive({ workspacePath, userReview: activeReview }),
  ).resolves.toEqual({ ok: true, value: archivedReview });
});

function createCommands(
  overrides: Partial<UserReviewCommands>,
): UserReviewCommands {
  return {
    listUserReviews: vi.fn(),
    createUserReview: vi.fn(),
    archiveUserReview: vi.fn(),
    ...overrides,
  };
}
