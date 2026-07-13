import { expect, test } from "vitest";

import {
  type StoredUserReview,
  UserReview,
} from "@/features/review-runs/domain/userReview";

const activeStoredReview: StoredUserReview = {
  schemaVersion: "spec-reviewer.user-review.v1",
  id: "urv_0123456789abcdef0123456789abcdef",
  status: "active",
  target: {
    scope: "file",
    specId: "auth-flow",
    fileKey: "tasks",
  },
  recordLocator: "urv_0123456789abcdef0123456789abcdef.json",
  commentCount: 2,
  createdAt: "2026-07-12T10:00:00Z",
  updatedAt: "2026-07-12T10:00:00Z",
  archivedAt: null,
};

test("active reviewをarchive可能なaggregateへrestoreする", () => {
  const result = UserReview.restore(activeStoredReview);

  expect(result).toEqual({
    ok: true,
    userReview: activeStoredReview,
  });
  if (result.ok) {
    expect(UserReview.canArchive(result.userReview)).toBe(true);
  }
});

test("active reviewをarchivedへ遷移する", () => {
  const restored = UserReview.restore(activeStoredReview);

  expect(restored.ok).toBe(true);
  if (!restored.ok) {
    return;
  }

  const result = UserReview.archive(
    restored.userReview,
    "2026-07-12T11:00:00Z",
  );

  expect(result).toEqual({
    ok: true,
    userReview: {
      ...activeStoredReview,
      status: "archived",
      updatedAt: "2026-07-12T11:00:00Z",
      archivedAt: "2026-07-12T11:00:00Z",
    },
  });
});

test("archived reviewは再度archiveできない", () => {
  const archivedReview: StoredUserReview = {
    ...activeStoredReview,
    status: "archived",
    updatedAt: "2026-07-12T11:00:00Z",
    archivedAt: "2026-07-12T11:00:00Z",
  };
  const restored = UserReview.restore(archivedReview);

  expect(restored.ok).toBe(true);
  if (!restored.ok) {
    return;
  }

  expect(UserReview.canArchive(restored.userReview)).toBe(false);
  expect(
    UserReview.archive(restored.userReview, "2026-07-12T12:00:00Z"),
  ).toEqual({
    ok: false,
    error: {
      reason: "alreadyArchived",
      id: archivedReview.id,
    },
  });
});

test.each([
  {
    name: "unsupported schema version",
    review: { ...activeStoredReview, schemaVersion: "legacy.v0" },
    reason: "unsupportedSchemaVersion",
  },
  {
    name: "zero comment count",
    review: { ...activeStoredReview, commentCount: 0 },
    reason: "invalidCommentCount",
  },
  {
    name: "fractional comment count",
    review: { ...activeStoredReview, commentCount: 1.5 },
    reason: "invalidCommentCount",
  },
  {
    name: "blank target spec id",
    review: {
      ...activeStoredReview,
      target: { ...activeStoredReview.target, specId: " " },
    },
    reason: "invalidTarget",
  },
  {
    name: "malformed target",
    review: {
      ...activeStoredReview,
      target: null,
    },
    reason: "invalidTarget",
  },
  {
    name: "non-canonical timestamp",
    review: {
      ...activeStoredReview,
      createdAt: "2026-07-12 10:00:00Z",
    },
    reason: "invalidTimestamp",
  },
  {
    name: "active timestamp mismatch",
    review: {
      ...activeStoredReview,
      updatedAt: "2026-07-12T10:00:01Z",
    },
    reason: "activeTimestampsDiffer",
  },
  {
    name: "active archivedAt",
    review: {
      ...activeStoredReview,
      archivedAt: "2026-07-12T10:00:00Z",
    },
    reason: "activeHasArchivedAt",
  },
  {
    name: "archived missing archivedAt",
    review: {
      ...activeStoredReview,
      status: "archived",
    },
    reason: "archivedMissingArchivedAt",
  },
  {
    name: "archived timestamp mismatch",
    review: {
      ...activeStoredReview,
      status: "archived",
      updatedAt: "2026-07-12T11:00:00Z",
      archivedAt: "2026-07-12T11:00:01Z",
    },
    reason: "archivedTimestampsDiffer",
  },
] as const)("$nameをtyped restore errorとして返す", ({ review, reason }) => {
  const result = UserReview.restore(review as StoredUserReview);

  expect(result).toMatchObject({
    ok: false,
    error: { reason },
  });
});

test("updatedAtより前のtimestampではarchiveできない", () => {
  const restored = UserReview.restore(activeStoredReview);

  expect(restored.ok).toBe(true);
  if (!restored.ok) {
    return;
  }

  expect(
    UserReview.archive(restored.userReview, "2026-07-12T09:59:59Z"),
  ).toEqual({
    ok: false,
    error: {
      reason: "archiveTimestampRollback",
      id: activeStoredReview.id,
    },
  });
});
