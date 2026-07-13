import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import { UserReviewTarget } from "@/features/review-runs/domain/userReviewTarget";
import { SpecViewSelection } from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");

test("UserReviewTarget.fromSelectionはfile scopeのtargetを作成する", () => {
  const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath,
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });

  expect(UserReviewTarget.fromSelection(selection)).toEqual({
    scope: "file",
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });
});

test("UserReviewTarget.fromSelectionはspec scopeならfileKeyなしでtargetを作成する", () => {
  const fileSelection = SpecViewSelection.synchronize(
    SpecViewSelection.empty(),
    {
      workspacePath,
      specId: TestValues.specId("auth"),
      fileKey: "tasks",
    },
  );
  const selection = SpecViewSelection.selectTargetScope(fileSelection, "spec");

  expect(UserReviewTarget.fromSelection(selection)).toEqual({
    scope: "spec",
    specId: TestValues.specId("auth"),
  });
});

test.each([
  SpecViewSelection.empty(),
  SpecViewSelection.selectWorkspace(SpecViewSelection.empty(), workspacePath),
  SpecViewSelection.selectSpec(
    SpecViewSelection.selectWorkspace(SpecViewSelection.empty(), workspacePath),
    TestValues.specId("auth"),
  ),
])("UserReviewTarget.fromSelectionはincomplete selectionならnullを返す", (selection) => {
  expect(UserReviewTarget.fromSelection(selection)).toBeNull();
});
