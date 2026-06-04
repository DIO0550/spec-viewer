import { expect, test } from "vitest";

import {
  ReviewRunTarget,
  ReviewRunTargetIdentity,
} from "@/features/review-runs/domain/reviewRunTarget";

test("ReviewRunTarget.createはfile scopeのtargetを作成する", () => {
  const target = ReviewRunTarget.create({
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

test("ReviewRunTarget.createはspec scopeならfileKeyなしでtargetを作成する", () => {
  const target = ReviewRunTarget.create({
    specId: "auth",
    fileKey: null,
    targetScope: "spec",
  });

  expect(target).toEqual({
    scope: "spec",
    specId: "auth",
  });
});

test("ReviewRunTarget.createはfile scopeのfileKeyが未選択ならnullを返す", () => {
  const target = ReviewRunTarget.create({
    specId: "auth",
    fileKey: null,
    targetScope: "file",
  });

  expect(target).toBeNull();
});

test("ReviewRunTargetIdentity.createはtargetのscope差分を表す", () => {
  const fileIdentity = ReviewRunTargetIdentity.create({
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  });
  const specIdentity = ReviewRunTargetIdentity.create({
    scope: "spec",
    specId: "auth",
  });

  expect(ReviewRunTargetIdentity.equals(fileIdentity, specIdentity)).toBe(
    false,
  );
  expect(ReviewRunTargetIdentity.equals(fileIdentity, fileIdentity)).toBe(true);
});
