import { expect, test } from "vitest";

import {
  UserReviewTarget,
  UserReviewTargetIdentity,
} from "@/features/review-runs/domain/userReviewTarget";

test("UserReviewTarget.createはfile scopeのtargetを作成する", () => {
  const target = UserReviewTarget.create({
    specId: "auth",
    fileKey: "tasks",
    targetScope: "file",
  });

  expect(target).toEqual({
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  });
});

test("UserReviewTarget.createはspec scopeならfileKeyなしでtargetを作成する", () => {
  const target = UserReviewTarget.create({
    specId: "auth",
    fileKey: null,
    targetScope: "spec",
  });

  expect(target).toEqual({
    scope: "spec",
    specId: "auth",
  });
});

test("UserReviewTarget.createはfile scopeのfileKeyが未選択ならnullを返す", () => {
  const target = UserReviewTarget.create({
    specId: "auth",
    fileKey: null,
    targetScope: "file",
  });

  expect(target).toBeNull();
});

test("UserReviewTargetIdentity.createはtargetのscope差分を表す", () => {
  const fileIdentity = UserReviewTargetIdentity.create({
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  });
  const specIdentity = UserReviewTargetIdentity.create({
    scope: "spec",
    specId: "auth",
  });

  expect(UserReviewTargetIdentity.equals(fileIdentity, specIdentity)).toBe(
    false,
  );
  expect(UserReviewTargetIdentity.equals(fileIdentity, fileIdentity)).toBe(
    true,
  );
});
