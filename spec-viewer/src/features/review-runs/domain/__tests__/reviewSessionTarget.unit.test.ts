import { expect, test } from "vitest";

import {
  ReviewSessionTarget,
  ReviewSessionTargetIdentity,
} from "@/features/review-runs/domain/reviewSessionTarget";

test("ReviewSessionTarget.createはfile scopeのtargetを作成する", () => {
  const target = ReviewSessionTarget.create({
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

test("ReviewSessionTarget.createはspec scopeならfileKeyなしでtargetを作成する", () => {
  const target = ReviewSessionTarget.create({
    specId: "auth",
    fileKey: null,
    targetScope: "spec",
  });

  expect(target).toEqual({
    scope: "spec",
    specId: "auth",
  });
});

test("ReviewSessionTarget.createはfile scopeのfileKeyが未選択ならnullを返す", () => {
  const target = ReviewSessionTarget.create({
    specId: "auth",
    fileKey: null,
    targetScope: "file",
  });

  expect(target).toBeNull();
});

test("ReviewSessionTargetIdentity.createはtargetのscope差分を表す", () => {
  const fileIdentity = ReviewSessionTargetIdentity.create({
    scope: "file",
    specId: "auth",
    fileKey: "tasks",
  });
  const specIdentity = ReviewSessionTargetIdentity.create({
    scope: "spec",
    specId: "auth",
  });

  expect(ReviewSessionTargetIdentity.equals(fileIdentity, specIdentity)).toBe(
    false,
  );
  expect(ReviewSessionTargetIdentity.equals(fileIdentity, fileIdentity)).toBe(
    true,
  );
});
