import { expect, test, vi } from "vitest";

import type {
  UserReviewRepository,
  UserReviewRepositoryResult,
} from "@/features/review-runs/application/ports/userReviewRepository";
import {
  createUserReviewUseCases,
  type PreparedCreateUserReview,
} from "@/features/review-runs/application/userReviewUseCases";
import { CommentId } from "@/features/comments/types/comment";
import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListOutcome } from "@/features/review-runs/domain/userReviewListOutcome";
import type { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
const target: UserReviewTarget = {
  scope: "file",
  specId: "auth-flow",
  fileKey: "tasks",
};
const otherTarget: UserReviewTarget = {
  scope: "file",
  specId: "billing",
  fileKey: "tasks",
};
const commentId = CommentId.fromString("cmt_one");
const activeReview = createActiveUserReview("urv_active");
const archivedReview: ArchivedUserReview = {
  ...activeReview,
  status: "archived",
  updatedAt: "2026-07-13T10:30:00Z",
  archivedAt: "2026-07-13T10:30:00Z",
};

test("list use caseはrepository outcomeをdomain collectionへ変換する", async () => {
  const repository = createRepository({
    list: success({
      active: [activeReview],
      archived: [],
      problems: [],
    }),
  });
  const useCases = createUserReviewUseCases(repository);

  const outcome = await useCases.list({
    workspacePath,
    target,
    correlationId: "review-list-1",
  });

  expect(outcome).toMatchObject({
    status: "listed",
    collection: { active: [activeReview] },
  });
  expect(repository.list).toHaveBeenCalledWith({
    workspacePath,
    target,
    correlationId: "review-list-1",
  });
});

test("create use caseはdomain commandで不正入力をrepository前に拒否する", () => {
  const repository = createRepository();
  const useCases = createUserReviewUseCases(repository);
  const preparation = useCases.prepareCreate({
    workspacePath,
    target,
    commentIds: [],
  });

  expect(preparation).toMatchObject({
    ok: false,
    error: { reason: "emptyCommentSelection" },
  });
  expect(repository.create).not.toHaveBeenCalled();
});

test("create use caseはvalidated commandだけをrepositoryへ渡す", async () => {
  const repository = createRepository({ create: success(activeReview) });
  const useCases = createUserReviewUseCases(repository);
  const preparation = useCases.prepareCreate({
    workspacePath,
    target,
    commentIds: [commentId],
  });
  expect(preparation.ok).toBe(true);
  const command = (preparation as PreparedCreateUserReview).command;

  await expect(useCases.create(command)).resolves.toEqual({
    status: "created",
    userReview: activeReview,
  });
  expect(repository.create).toHaveBeenCalledWith(command);
});

test("archive use caseはtarget不一致をrepository前に拒否する", () => {
  const repository = createRepository();
  const useCases = createUserReviewUseCases(repository);

  expect(
    useCases.prepareArchive({
      workspacePath,
      target: otherTarget,
      userReview: activeReview,
    }),
  ).toEqual({ ok: false, reason: "targetMismatch" });
  expect(repository.archive).not.toHaveBeenCalled();
});

test("repository failureはbackendと同じerror codeのapplication outcomeになる", async () => {
  const repository = createRepository({
    list: {
      ok: false,
      error: {
        code: "userReviewRepository",
        message: "Review repository is unavailable",
        cause: new Error("disk unavailable"),
      },
    },
  });
  const useCases = createUserReviewUseCases(repository);

  await expect(
    useCases.list({ workspacePath, target, correlationId: null }),
  ).resolves.toMatchObject({
    status: "failed",
    error: {
      feature: "userReviews",
      code: "userReviewRepository",
      message: "Review repository is unavailable",
    },
  });
});

type RepositoryOutcomes = Readonly<{
  list: UserReviewRepositoryResult<UserReviewListOutcome>;
  create: UserReviewRepositoryResult<ActiveUserReview>;
  archive: UserReviewRepositoryResult<ArchivedUserReview>;
}>;

function createRepository(
  outcomes: Partial<RepositoryOutcomes> = {},
): UserReviewRepository {
  return {
    list: vi
      .fn()
      .mockResolvedValue(
        outcomes.list ?? success({ active: [], archived: [], problems: [] }),
      ),
    create: vi.fn().mockResolvedValue(outcomes.create ?? success(activeReview)),
    archive: vi
      .fn()
      .mockResolvedValue(outcomes.archive ?? success(archivedReview)),
  };
}

function success<T>(value: T): UserReviewRepositoryResult<T> {
  return { ok: true, value };
}

function createActiveUserReview(id: string): ActiveUserReview {
  return {
    schemaVersion: "spec-reviewer.user-review.v1",
    id,
    status: "active",
    target,
    recordLocator: `${id}.json`,
    commentCount: 1,
    createdAt: "2026-07-13T10:00:00Z",
    updatedAt: "2026-07-13T10:00:00Z",
    archivedAt: null,
  };
}
