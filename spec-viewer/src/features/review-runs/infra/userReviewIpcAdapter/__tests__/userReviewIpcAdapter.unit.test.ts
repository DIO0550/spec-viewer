import { expect, test } from "vitest";

import {
  mapListUserReviewsResponseToUserReviews,
  mapUserReviewDtoToUserReview,
  UserReviewDtoRestoreError,
  UserReviewIpcCodecError,
  UserReviewListRestoreError,
} from "@/features/review-runs/infra/userReviewIpcAdapter";
import type {
  ListUserReviewsResponse,
  UserReviewDto,
} from "@/features/review-runs/types/userReviewIpc";

const activeReview = createUserReview({
  id: "urv_0123456789abcdef0123456789abcdef",
  status: "active",
  updatedAt: "2026-07-12T10:00:00Z",
  archivedAt: null,
});

const archivedReview = createUserReview({
  id: "urv_fedcba9876543210fedcba9876543210",
  status: "archived",
  updatedAt: "2026-07-12T11:00:00Z",
  archivedAt: "2026-07-12T11:00:00Z",
});

test("mapUserReviewDtoToUserReviewはsingle-JSON summaryをaggregateへrestoreする", () => {
  expect(mapUserReviewDtoToUserReview(activeReview)).toEqual(activeReview);
});

test("mapUserReviewDtoToUserReviewはinvariant違反をtyped errorで拒否する", () => {
  const invalidReview = { ...activeReview, commentCount: 0 };

  expect(() => mapUserReviewDtoToUserReview(invalidReview)).toThrowError(
    UserReviewDtoRestoreError,
  );
  expect(() => mapUserReviewDtoToUserReview(invalidReview)).toThrow(
    expect.objectContaining({
      reason: "invalidCommentCount",
      userReviewId: invalidReview.id,
    }),
  );
});

test.each([
  undefined,
  null,
  [],
  {},
  { ...activeReview, id: undefined },
])("mapUserReviewDtoToUserReviewは不正DTO %p をtyped codec errorで拒否する", (review) => {
  expect(() => mapUserReviewDtoToUserReview(review)).toThrowError(
    UserReviewIpcCodecError,
  );
  expect(() => mapUserReviewDtoToUserReview(review)).not.toThrowError(
    TypeError,
  );
});

test.each([
  { response: undefined, path: "response" },
  { response: null, path: "response" },
  { response: [], path: "response" },
  {
    response: { active: null, archived: [], problems: [] },
    path: "response.active",
  },
  {
    response: { active: [], archived: {}, problems: [] },
    path: "response.archived",
  },
  {
    response: { active: [], archived: [], problems: "invalid" },
    path: "response.problems",
  },
] as const)("list responseの不正envelopeをtyped codec errorで拒否する", ({
  response,
  path,
}) => {
  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrow(
    expect.objectContaining({
      name: "UserReviewIpcCodecError",
      reason: "invalidShape",
      path,
    }),
  );
  expect(() =>
    mapListUserReviewsResponseToUserReviews(response),
  ).not.toThrowError(TypeError);
});

test.each([
  { problem: null, path: "response.problems[0]" },
  {
    problem: { recordLocator: 1, kind: "malformedDocument", message: "bad" },
    path: "response.problems[0].recordLocator",
  },
  {
    problem: { recordLocator: "bad.json", kind: "unknown", message: "bad" },
    path: "response.problems[0].kind",
  },
  {
    problem: {
      recordLocator: "bad.json",
      kind: "malformedDocument",
      message: null,
    },
    path: "response.problems[0].message",
  },
] as const)("list responseの不正problem fieldをtyped codec errorで拒否する", ({
  problem,
  path,
}) => {
  const response = { active: [], archived: [], problems: [problem] };

  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrow(
    expect.objectContaining({
      name: "UserReviewIpcCodecError",
      reason: "invalidShape",
      path,
    }),
  );
});

test("list responseのrecord problemをdomain conceptへ変換する", () => {
  const response: ListUserReviewsResponse = {
    active: [activeReview],
    archived: [archivedReview],
    problems: [
      {
        recordLocator: "legacy-run",
        kind: "legacyFolderBundle",
        message: "Legacy folder bundle is read-only",
      },
      {
        recordLocator: "broken.json",
        kind: "malformedDocument",
        message: "Malformed user review document",
      },
    ],
  };

  expect(mapListUserReviewsResponseToUserReviews(response)).toEqual({
    active: [activeReview],
    archived: [archivedReview],
    problems: [
      {
        locator: "legacy-run",
        kind: "legacyRecord",
        message: "Legacy folder bundle is read-only",
      },
      {
        locator: "broken.json",
        kind: "malformedRecord",
        message: "Malformed user review document",
      },
    ],
  });
});

test.each([
  {
    collection: "active",
    response: { active: [archivedReview], archived: [], problems: [] },
    review: archivedReview,
  },
  {
    collection: "archived",
    response: { active: [], archived: [activeReview], problems: [] },
    review: activeReview,
  },
] as const)("$collection collectionとstatusの不整合をtyped errorで拒否する", ({
  collection,
  response,
  review,
}) => {
  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrowError(
    UserReviewListRestoreError,
  );
  expect(() => mapListUserReviewsResponseToUserReviews(response)).toThrow(
    expect.objectContaining({
      reason: "collectionStatusMismatch",
      collection,
      userReviewId: review.id,
    }),
  );
});

function createUserReview(
  input: Pick<UserReviewDto, "archivedAt" | "id" | "status" | "updatedAt">,
): UserReviewDto {
  return {
    schemaVersion: "spec-reviewer.user-review.v1",
    id: input.id,
    status: input.status,
    target: {
      scope: "file",
      specId: "auth-flow",
      fileKey: "tasks",
    },
    recordLocator: `${input.id}.json`,
    commentCount: 2,
    createdAt: "2026-07-12T10:00:00Z",
    updatedAt: input.updatedAt,
    archivedAt: input.archivedAt,
  };
}
